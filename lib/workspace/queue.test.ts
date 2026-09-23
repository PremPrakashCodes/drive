import { describe, expect, it, vi } from "vitest";

import { createUploadQueue } from "@/lib/workspace/queue";

// A held transfer looks again on a timer; 1ms keeps these honest and quick.
const queue = (onDrain?: () => void) => createUploadQueue({ onDrain, poll: 1 });

// Whether `promise` is still waiting once the event loop has had a turn.
const waiting = async (promise: Promise<unknown>) => {
  const held = Symbol("held");
  return (
    (await Promise.race([promise, new Promise((r) => setTimeout(() => r(held), 20))])) === held
  );
};

// Something queued that finishes when the test says so.
const job = (q: ReturnType<typeof queue>, id: string) => {
  let done = () => {};
  const finished = q.queued(id, () => new Promise<void>((resolve) => (done = resolve)));
  return { finish: () => done(), finished };
};

describe("holding transfers while the queue is paused", () => {
  it("lets a transfer start while the queue is running", async () => {
    await expect(queue().ready("a")).resolves.toBe(true);
  });

  // The gate is what pause acts on, and it is reached when a transfer is
  // about to start — not when the queue was filled, which happens in one tick.
  it("holds a transfer that reaches the gate after the pause", async () => {
    const q = queue();
    q.toggle();

    const held = q.ready("a");
    expect(await waiting(held)).toBe(true);

    q.toggle();
    await expect(held).resolves.toBe(true);
  });

  it("lets a transfer cancelled while it waits give up", async () => {
    const q = queue();
    q.toggle();
    const held = q.ready("a");

    q.cancel("a");

    await expect(held).resolves.toBe(false);
  });

  it("reports the state the pause control should show", () => {
    const q = queue();

    expect(q.paused()).toBe(false);
    expect(q.toggle()).toBe(true);
    expect(q.paused()).toBe(true);
    expect(q.toggle()).toBe(false);
  });
});

describe("a pause outliving the queue it was made for", () => {
  it("holds the pause while something is still queued", async () => {
    const q = queue();
    const first = job(q, "a");
    const second = job(q, "b");
    q.toggle();

    first.finish();
    await first.finished;

    expect(q.paused()).toBe(true);
    second.finish();
    await second.finished;
  });

  // The control that releases a pause is only on screen while something is
  // uploading. A flag left set once the queue drained would hold the next
  // upload with nothing on screen to let it go.
  it("releases the pause once the queue has drained", async () => {
    const drained = vi.fn();
    const q = queue(drained);
    const only = job(q, "a");
    q.toggle();

    only.finish();
    await only.finished;

    expect(q.paused()).toBe(false);
    expect(drained).toHaveBeenCalledTimes(1);
  });

  it("releases the pause when the last thing queued failed", async () => {
    const q = queue();
    q.toggle();

    await expect(q.queued("a", () => Promise.reject(new Error("storage said no")))).rejects.toThrow(
      "storage said no"
    );

    expect(q.paused()).toBe(false);
  });

  it("starts a later upload straight away", async () => {
    const q = queue();
    const first = job(q, "a");
    q.toggle();
    first.finish();
    await first.finished;

    const later = q.queued("b", () => q.ready("b"));

    expect(await waiting(later)).toBe(false);
    await expect(later).resolves.toBe(true);
  });
});
