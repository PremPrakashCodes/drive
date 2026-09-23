import { describe, expect, it, vi } from "vitest";

import {
  createSlots,
  MAX_TRANSFERS,
  MAX_UPLOAD,
  NETWORK_FAILURE,
  oversize,
  storageRejected,
  TOO_LARGE,
} from "@/lib/workspace/transfer";

// Something that finishes when the test says so.
const held = () => {
  let done = () => {};
  const work = () => new Promise<void>((resolve) => (done = resolve));
  return { work, finish: () => done() };
};

// A single PUT is all this drive ever sends — multipart is deliberately not in
// the picture — so the ceiling has to be one a single request can carry on
// both providers the drive supports.
describe("the size a single request can carry", () => {
  it("stays inside what S3 and R2 accept in one PUT", () => {
    // S3 refuses a single PUT over 5 GB; R2's single-part limit is 4.995 GiB.
    expect(MAX_UPLOAD).toBeLessThanOrEqual(4.995 * 1024 ** 3);
    expect(MAX_UPLOAD).toBeLessThanOrEqual(5 * 1000 ** 3);
  });

  it("refuses a file over the ceiling and takes one just under it", () => {
    expect(oversize(MAX_UPLOAD + 1)).toBe(true);
    expect(oversize(MAX_UPLOAD)).toBe(false);
    expect(oversize(MAX_UPLOAD - 1)).toBe(false);
  });

  it("names the limit in the refusal", () => {
    expect(TOO_LARGE).toMatch(/5 GB/);
  });
});

// Every URL in a batch used to be signed together while every transfer started
// at once, so files late in a large queue reached storage with an expired URL.
// A bounded number of slots is what lets a URL be signed when its own transfer
// is about to start.
describe("capping how many transfers run at once", () => {
  it("never runs more than the cap at once", async () => {
    const slots = createSlots(2);
    let running = 0;
    let peak = 0;
    const jobs = Array.from({ length: 8 }, () => held());
    const all = jobs.map((job) =>
      slots.run(async () => {
        running++;
        peak = Math.max(peak, running);
        await job.work();
        running--;
      })
    );

    // Finish them one at a time, so a slot is always being handed over.
    for (const job of jobs) {
      await Promise.resolve();
      job.finish();
      await Promise.resolve();
    }
    await Promise.all(all);

    expect(peak).toBe(2);
  });

  it("starts nothing until a slot opens", async () => {
    const slots = createSlots(1);
    const first = held();
    const later = vi.fn(async () => {});

    const running = slots.run(first.work);
    void slots.run(later);
    await Promise.resolve();

    expect(later).not.toHaveBeenCalled();
    first.finish();
    await running;
    await Promise.resolve();
    expect(later).toHaveBeenCalled();
  });

  it("hands the slot on when a transfer fails", async () => {
    const slots = createSlots(1);
    const after = vi.fn(async () => {});

    await expect(slots.run(() => Promise.reject(new Error("storage said no")))).rejects.toThrow(
      "storage said no"
    );
    await slots.run(after);

    expect(after).toHaveBeenCalled();
  });

  it("leaves room on the connection for the rest of the page", () => {
    // Browsers open about six connections per host, and previews and downloads
    // go to the same bucket.
    expect(MAX_TRANSFERS).toBeGreaterThan(0);
    expect(MAX_TRANSFERS).toBeLessThan(6);
  });
});

// Every failed transfer used to be reported as a bucket CORS problem, whatever
// had actually happened.
describe("saying what went wrong with a transfer", () => {
  it("reports a rejected request with the status storage sent", () => {
    expect(storageRejected(403, "Forbidden")).toMatch(/403/);
    expect(storageRejected(403, "Forbidden")).toMatch(/Forbidden/);
    expect(storageRejected(500)).toMatch(/500/);
  });

  it("reports a connection failure as a connection failure", () => {
    expect(NETWORK_FAILURE).toMatch(/connection/i);
    expect(NETWORK_FAILURE).not.toMatch(/CORS|configur/i);
  });
});
