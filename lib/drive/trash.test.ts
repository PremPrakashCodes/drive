import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { MAX_TREE_DEPTH } from "@/lib/drive/action";
import { workspaceBucket } from "@/lib/drive/s3";
import { purgeExpiredTrash } from "@/lib/drive/trash";

// Cron: no request, no session, so it's stubbed at the db/bucket boundary the
// way orphans.test.ts and items.test.ts stub the same modules.
vi.mock("@/lib/drive/s3", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/drive/s3")>();
  return { ...actual, workspaceBucket: vi.fn(actual.workspaceBucket) };
});

const now = new Date("2026-09-23T12:00:00.000Z");

describe("walking the expired tree", () => {
  let reads: unknown[][];
  let remove: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // Each call answers with the next queued batch, in call order — the walk
    // is sequential (one workspace, one level, one chunk at a time here), so
    // that order is exactly the order the code issues its selects.
    vi.spyOn(db, "select").mockImplementation((() => ({
      from: () => ({ where: async () => reads.shift() ?? [] }),
    })) as never);
    vi.spyOn(db, "delete").mockImplementation((() => ({ where: async () => {} })) as never);
    remove = vi.fn(async () => {});
    vi.mocked(workspaceBucket).mockResolvedValue({ remove } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deduplicates a row reached twice via the visited set", async () => {
    const ws = randomUUID();
    const [a, b, c, d] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    reads = [
      // The initial "what's expired" scan: one root.
      [{ id: a, organizationId: ws, parentId: null }],
      // Level 0 (first=true): the root's own row, with its storage key.
      [{ id: a, storageKey: "w/a" }],
      // Level 1: A's children. B comes back twice — a single foreign key
      // can't produce this from real rows, but the `seen` guard exists for
      // exactly this shape, so it's exercised directly rather than assumed.
      [
        { id: b, storageKey: "w/b" },
        { id: c, storageKey: "w/c" },
        { id: b, storageKey: "w/b" },
      ],
      // Level 2: B's only child.
      [{ id: d, storageKey: "w/d" }],
      // Level 3: nothing left.
      [],
    ];

    const result = await purgeExpiredTrash(now);

    expect(result.failed).toEqual([]);
    // Four unique rows (A, B, C, D) — the repeated B wasn't double-counted.
    expect(result.deleted).toBe(4);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(["w/a", "w/b", "w/c", "w/d"]);
  });

  it("stops at MAX_TREE_DEPTH instead of walking a parent cycle forever", async () => {
    const ws = randomUUID();
    const root = randomUUID();
    // A chain of fresh, never-repeated ids: since none of them is ever seen
    // twice, the `seen` set alone would never end this walk — only the depth
    // cap can. Long enough that exhausting it (rather than hitting the cap)
    // would mean the guard is broken.
    const chain = Array.from({ length: MAX_TREE_DEPTH + 50 }, () => randomUUID());
    let calls = 0;
    // A read budget independent of the code under test: if MAX_TREE_DEPTH
    // were missing or broken, this throws instead of the suite hanging on an
    // unbounded loop.
    const BUDGET = MAX_TREE_DEPTH + 20;
    vi.spyOn(db, "select").mockImplementation((() => ({
      from: () => ({
        where: async () => {
          calls++;
          if (calls > BUDGET) throw new Error("test read budget exceeded — walk did not stop");
          if (calls === 1) return [{ id: root, organizationId: ws, parentId: null }];
          return [{ id: chain[calls - 2], storageKey: `w/${calls}` }];
        },
      }),
    })) as never);

    const result = await purgeExpiredTrash(now);

    expect(result.failed).toEqual([ws]);
    // One read for the initial scan, then exactly MAX_TREE_DEPTH level reads
    // before the depth check throws on what would have been level 128.
    expect(calls).toBe(1 + MAX_TREE_DEPTH);
    expect(calls).toBeLessThan(BUDGET);
    // The throw happened before any row was counted for this workspace.
    expect(result.deleted).toBe(0);
  });
});

describe("storage-write ordering", () => {
  let order: string[];
  let remove: ReturnType<typeof vi.fn>;

  const setup = (organizationId: string, id: string, storageKey: string) => {
    return [[{ id, organizationId, parentId: null }], [{ id, storageKey }], []];
  };

  beforeEach(() => {
    order = [];
    vi.spyOn(console, "error").mockImplementation(() => {});
    remove = vi.fn(async () => {
      order.push("objects");
    });
    vi.mocked(workspaceBucket).mockResolvedValue({ remove } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes rows before removing their bucket objects", async () => {
    const ws = randomUUID();
    const id = randomUUID();
    const reads = setup(ws, id, "w/object");
    vi.spyOn(db, "select").mockImplementation((() => ({
      from: () => ({ where: async () => reads.shift() ?? [] }),
    })) as never);
    vi.spyOn(db, "delete").mockImplementation((() => ({
      where: async () => {
        order.push("rows");
      },
    })) as never);

    const result = await purgeExpiredTrash(now);

    expect(result.failed).toEqual([]);
    expect(order).toEqual(["rows", "objects"]);
  });

  it("keeps the deleted count accurate even when object removal throws", async () => {
    const ws = randomUUID();
    const id = randomUUID();
    const reads = setup(ws, id, "w/object");
    vi.spyOn(db, "select").mockImplementation((() => ({
      from: () => ({ where: async () => reads.shift() ?? [] }),
    })) as never);
    vi.spyOn(db, "delete").mockImplementation((() => ({
      where: async () => {
        order.push("rows");
      },
    })) as never);
    remove.mockRejectedValue(new Error("bucket unreachable"));

    const result = await purgeExpiredTrash(now);

    // The row really was deleted before the bucket call failed, so counting
    // it as removed is correct — the workspace is still reported as failed
    // for the leftover object, which the orphan sweeper will reclaim.
    expect(result.deleted).toBe(1);
    expect(result.failed).toEqual([ws]);
    expect(order).toEqual(["rows"]);
  });
});

describe("isolation across workspaces", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records a workspace whose bucket.remove fails while still sweeping the rest", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = randomUUID();
    const healthy = randomUUID();
    const failingItem = randomUUID();
    const healthyItem = randomUUID();

    const reads: unknown[][] = [
      // Initial scan: one expired root in each workspace.
      [
        { id: failingItem, organizationId: failing, parentId: null },
        { id: healthyItem, organizationId: healthy, parentId: null },
      ],
      // Level 0 for `failing` (processed first, insertion order of the Map).
      [{ id: failingItem, storageKey: "failing/object" }],
      [],
      // Level 0 for `healthy`.
      [{ id: healthyItem, storageKey: "healthy/object" }],
      [],
    ];
    vi.spyOn(db, "select").mockImplementation((() => ({
      from: () => ({ where: async () => reads.shift() ?? [] }),
    })) as never);
    vi.spyOn(db, "delete").mockImplementation((() => ({ where: async () => {} })) as never);
    const remove = vi.fn(async (keys: string[]) => {
      if (keys[0]?.startsWith("failing/")) throw new Error("bucket unreachable");
    });
    vi.mocked(workspaceBucket).mockResolvedValue({ remove } as never);

    const result = await purgeExpiredTrash(now);

    expect(result.failed).toEqual([failing]);
    // Both rows were deleted (the failure is only in bucket cleanup), so both
    // count — the healthy workspace's sweep wasn't skipped or short-circuited.
    expect(result.deleted).toBe(2);
    expect(remove).toHaveBeenCalledWith(["failing/object"]);
    expect(remove).toHaveBeenCalledWith(["healthy/object"]);
  });
});
