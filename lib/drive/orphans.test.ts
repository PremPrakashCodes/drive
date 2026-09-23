import type { StoredObject } from "@/types";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { ORPHAN_GRACE_MS, reclaimable, reclaimOrphans, unbacked } from "@/lib/drive/orphans";
import { workspaceBucket } from "@/lib/drive/s3";
import { DriveError } from "@/lib/drive/workspace";

vi.mock("@/lib/drive/s3", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/drive/s3")>();
  return { ...actual, workspaceBucket: vi.fn(actual.workspaceBucket) };
});

const now = new Date("2026-09-23T12:00:00.000Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const object = (key: string, lastModified: Date | null): StoredObject => ({ key, lastModified });

// The two halves of the sweep, without a bucket or a database: which listed
// objects may be removed, and which rows point at bytes that aren't there.
describe("what a sweep may reclaim", () => {
  it("is the objects no row references", () => {
    const objects = [
      object("ws/kept", ago(ORPHAN_GRACE_MS * 2)),
      object("ws/orphan", ago(ORPHAN_GRACE_MS * 2)),
    ];
    expect(reclaimable(objects, new Set(["ws/kept"]), now)).toEqual(["ws/orphan"]);
  });

  it("spares an object younger than the grace period", () => {
    // An upload that has landed in the bucket while its row is still being
    // written: seconds old, referenced by nothing yet, and not the sweep's.
    const objects = [object("ws/in-flight", ago(2000)), object("ws/old", ago(ORPHAN_GRACE_MS + 1))];
    expect(reclaimable(objects, new Set(), now)).toEqual(["ws/old"]);
  });

  it("spares an object exactly at the grace period", () => {
    expect(reclaimable([object("ws/edge", ago(ORPHAN_GRACE_MS))], new Set(), now)).toEqual([]);
  });

  it("spares an object whose age the listing didn't report", () => {
    expect(reclaimable([object("ws/unknown", null)], new Set(), now)).toEqual([]);
  });

  it("waits a full day before reclaiming", () => {
    expect(ORPHAN_GRACE_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe("rows whose object is absent", () => {
  it("names the rows the bucket has no bytes for", () => {
    const rows = [
      { id: "row-here", storageKey: "ws/here" },
      { id: "row-gone", storageKey: "ws/gone" },
    ];
    expect(unbacked(rows, new Set(["ws/here"]))).toEqual(["row-gone"]);
  });

  it("is empty when every row has its object", () => {
    const rows = [{ id: "row-here", storageKey: "ws/here" }];
    expect(unbacked(rows, new Set(["ws/here"]))).toEqual([]);
  });
});

// One sweep over stubbed workspaces: the reads it makes in order are the
// workspace ids, then each workspace's referenced keys.
describe("a sweep across workspaces", () => {
  const first = randomUUID();
  const second = randomUUID();
  let reads: unknown[][];
  let remove: ReturnType<typeof vi.fn>;
  let list: ReturnType<typeof vi.fn>;

  const thenable = (rows: unknown[]) => ({
    where: async () => rows,
    then: (resolve: (value: unknown[]) => void) => resolve(rows),
  });

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(db, "select").mockImplementation((() => ({
      from: () => thenable(reads.shift() ?? []),
    })) as never);
    remove = vi.fn(async () => {});
    list = vi.fn(async () => []);
    vi.mocked(workspaceBucket).mockResolvedValue({ list, remove } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reclaims exactly the unreferenced keys under the workspace prefix", async () => {
    reads = [[{ id: first }], [{ id: "row", storageKey: `${first}/kept` }]];
    list.mockResolvedValue([
      object(`${first}/kept`, ago(ORPHAN_GRACE_MS * 2)),
      object(`${first}/orphan`, ago(ORPHAN_GRACE_MS * 2)),
    ]);

    const result = await reclaimOrphans(now);

    expect(list).toHaveBeenCalledWith(`${first}/`);
    expect(remove).toHaveBeenCalledWith([`${first}/orphan`]);
    expect(result).toMatchObject({ reclaimed: 1, unbacked: [], skipped: 0, failed: [] });
  });

  it("reports a row whose object is absent without deleting it", async () => {
    reads = [[{ id: first }], [{ id: "row-gone", storageKey: `${first}/gone` }]];
    list.mockResolvedValue([]);
    const remove_ = vi.spyOn(db, "delete");

    const result = await reclaimOrphans(now);

    expect(result.unbacked).toEqual(["row-gone"]);
    expect(remove_).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("skips a workspace with no storage and sweeps the next one", async () => {
    reads = [[{ id: first }, { id: second }], [], []];
    vi.mocked(workspaceBucket).mockImplementation(async (id: string) => {
      if (id === first) throw new DriveError("This drive has no storage yet.");
      return { list, remove } as never;
    });
    list.mockResolvedValue([object(`${second}/orphan`, ago(ORPHAN_GRACE_MS * 2))]);

    const result = await reclaimOrphans(now);

    expect(result).toMatchObject({ reclaimed: 1, skipped: 1, failed: [] });
    expect(remove).toHaveBeenCalledWith([`${second}/orphan`]);
  });

  it("records a failing workspace and carries on", async () => {
    reads = [[{ id: first }, { id: second }], [], []];
    list.mockImplementation(async (prefix: string) => {
      if (prefix === `${first}/`) throw new Error("bucket unreachable");
      return [object(`${second}/orphan`, ago(ORPHAN_GRACE_MS * 2))];
    });

    const result = await reclaimOrphans(now);

    expect(result.failed).toEqual([first]);
    expect(result.reclaimed).toBe(1);
  });
});
