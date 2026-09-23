import type { NewDriveItem } from "@/db/schema";
import type { Workspace } from "@/types";
import type { SQL } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { driveItems, members, organizations, users } from "@/db/schema";
import { createFolderTree } from "@/lib/drive/items";
import { headroomRefusal, STORAGE_QUOTA } from "@/lib/drive/quota";
import { workspaceBucket } from "@/lib/drive/s3";
import { checkHeadroom, completeUploads, prepareUploads } from "@/lib/drive/uploads";
import { requireWorkspace } from "@/lib/drive/workspace";
import { folderBatches } from "@/lib/workspace/folder-batches";
import { MAX_UPLOAD } from "@/lib/workspace/transfer";
import { describeDb } from "@/test/db";

// `requireWorkspace` reads cookies and the session, and the bucket is the one
// store these actions touch that isn't the database. Standing in for them is
// what lets the actions run outside a request; the rest stays the real module.
vi.mock("@/lib/drive/workspace", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/drive/workspace")>();
  return { ...actual, requireWorkspace: vi.fn(actual.requireWorkspace) };
});
vi.mock("@/lib/drive/s3", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/drive/s3")>();
  return { ...actual, workspaceBucket: vi.fn(actual.workspaceBucket) };
});

const workspace = (id: string, userId: string): Workspace => ({
  id,
  name: "Test drive",
  role: "owner",
  userId,
  own: true,
  kind: "personal",
});

// An object that reached storage: two bytes of text, which `detectFile` reads.
const stored = (contentLength = 2) => ({
  head: vi.fn(async () => ({ ContentLength: contentLength })),
  peekBytes: vi.fn(async () => new TextEncoder().encode("hi")),
  remove: vi.fn(async () => {}),
  uploadUrl: vi.fn(async (key: string) => `https://bucket.test/${key}`),
});

// What the drive is already holding, for the storage ceiling. Postgres sums
// bigints as a string.
const usage = (used: number) =>
  vi.spyOn(db, "select").mockReturnValue({
    from: () => ({ where: async () => [{ used: String(used) }] }),
  } as never);

const completion = (key: string) => ({
  key,
  name: "Report.txt",
  type: "text/plain",
  parentId: null,
  private: false,
});

// Drizzle renders a condition to SQL plus its bind parameters; reading them
// back is how a stub sees which rows a query would have matched.
const bindings = (condition: SQL) =>
  (
    db as unknown as { dialect: { sqlToQuery(sql: SQL): { params: unknown[] } } }
  ).dialect.sqlToQuery(condition).params as string[];

// The storage key is minted per file by `prepareUploads`, so a retried
// completion replays the same key. Recording it again must land on the row
// that is already there rather than a second row over the same object.
describe("recording an upload that was already recorded", () => {
  const ws = workspace(randomUUID(), randomUUID());
  let conflict: unknown;
  let rows: NewDriveItem[];

  // Answers the insert with `returned`, capturing what it may conflict on.
  const insert = (returned: { id: string }[]) =>
    vi.spyOn(db, "insert").mockReturnValue({
      values: (values: NewDriveItem[]) => {
        rows = [values].flat();
        return {
          onConflictDoNothing: (config?: { target?: unknown }) => {
            conflict = config?.target;
            return { returning: async () => returned };
          },
          returning: async () => returned,
        };
      },
    } as never);

  beforeEach(() => {
    conflict = undefined;
    rows = [];
    vi.mocked(requireWorkspace).mockResolvedValue(ws);
    vi.mocked(workspaceBucket).mockResolvedValue(stored() as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("answers with the row the first call wrote", async () => {
    const already = randomUUID();
    insert([]); // Postgres ignored the insert, so it returned nothing.
    vi.spyOn(db, "select").mockReturnValue({
      from: () => ({ where: async () => [{ id: already }] }),
    } as never);

    const result = await completeUploads([completion(`${ws.id}/${randomUUID()}`)]);

    expect(result).toEqual({ ok: true, data: [{ ok: true, data: already }] });
  });

  it("asks Postgres to ignore a storage key this drive already has", async () => {
    insert([{ id: randomUUID() }]);

    await completeUploads([completion(`${ws.id}/${randomUUID()}`)]);

    expect(conflict).toEqual([driveItems.organizationId, driveItems.storageKey]);
  });

  it("looks for the row that is already there in the caller's own drive", async () => {
    const key = `${ws.id}/${randomUUID()}`;
    let asked: string[] = [];
    insert([]);
    vi.spyOn(db, "select").mockImplementation((() => ({
      from: () => ({
        where: async (condition: SQL) => {
          asked = bindings(condition);
          return [{ id: randomUUID() }];
        },
      }),
    })) as never);

    await completeUploads([completion(key)]);

    // Scoped to the workspace and the key: another drive's storage key can
    // never answer this lookup.
    expect(asked).toEqual(expect.arrayContaining([ws.id, key]));
  });

  it("says so when neither the insert nor the lookup produced a row", async () => {
    insert([]);
    vi.spyOn(db, "select").mockReturnValue({ from: () => ({ where: async () => [] }) } as never);

    const result = await completeUploads([completion(`${ws.id}/${randomUUID()}`)]);

    // Not a thrown "Something went wrong": the file didn't get recorded.
    expect(result).toEqual({ ok: true, data: [{ ok: false, error: expect.any(String) }] });
  });

  it("refuses a key minted for another drive", async () => {
    const spy = insert([{ id: randomUUID() }]);

    const result = await completeUploads([completion(`${randomUUID()}/${randomUUID()}`)]);

    expect(result).toEqual({
      ok: true,
      data: [{ ok: false, error: expect.stringMatching(/invalid upload/i) }],
    });
    expect(spy).not.toHaveBeenCalled();
    expect(rows).toEqual([]);
  });
});

// A folder upload recreates its tree before its files go up. Dropping the
// same folder again must fill in the tree that is there, not build a second
// one beside it — and two folders the client kept apart must stay apart.
describe("recreating an uploaded folder tree", () => {
  const ws = workspace(randomUUID(), randomUUID());
  let rows: NewDriveItem[];
  let lookups: string[][];

  const inserted = () =>
    vi.spyOn(db, "insert").mockReturnValue({
      values: async (values: NewDriveItem[]) => {
        rows = [values].flat();
      },
    } as never);

  // Answers each level's sibling lookup with `folders`, given what it asked
  // for, and records every lookup the call made.
  const siblings = (folders: (asked: string[]) => unknown[]) =>
    vi.spyOn(db, "select").mockImplementation((() => ({
      from: () => ({
        where: async (condition: SQL) => {
          const asked = bindings(condition);
          lookups.push(asked);
          return folders(asked);
        },
      }),
    })) as never);

  const folder = (over: Record<string, unknown>) => ({
    id: randomUUID(),
    parentId: null,
    name: "Trip",
    visibility: "shared",
    createdById: ws.userId,
    lockedAt: null,
    createdAt: new Date(),
    ...over,
  });

  beforeEach(() => {
    rows = [];
    lookups = [];
    vi.mocked(requireWorkspace).mockResolvedValue(ws);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps apart two folders whose names differ only in the space around them", async () => {
    inserted();
    siblings(() => []);

    const result = await createFolderTree({
      parentId: null,
      folders: [[" Trip "], ["Trip"], [" Trip ", "Photos"]],
    });

    expect(result.ok).toBe(true);
    const ids = result.ok ? result.data : [];
    expect(new Set(ids).size).toBe(3);
    // The subtree belongs to the folder the client put it under.
    expect(rows.find((r) => r.name === "Photos")?.parentId).toBe(ids[0]);
  });

  it("lands a repeated drop in the folder that is already there", async () => {
    const trip = folder({});
    inserted();
    // The drive holds "Trip" at the top level and nothing inside it yet.
    siblings((asked) => (asked.includes(trip.id) ? [] : [trip]));

    const result = await createFolderTree({
      parentId: null,
      folders: [["Trip"], ["Trip", "Photos"]],
    });

    expect(result).toEqual({ ok: true, data: [trip.id, expect.any(String)] });
    // Only the new subfolder is written, inside the folder already there.
    expect(rows).toEqual([expect.objectContaining({ name: "Photos", parentId: trip.id })]);
    // Scoped to this drive: a folder in someone else's can't be the one a
    // path names, however its parent reference reads.
    expect(lookups[0]).toContain(ws.id);
  });

  it("makes one folder of a path the drop lists twice", async () => {
    inserted();
    siblings(() => []);

    const result = await createFolderTree({ parentId: null, folders: [["Trip"], ["Trip"]] });

    expect(result.ok && result.data[0]).toBe(result.ok ? result.data[1] : null);
    expect(rows).toHaveLength(1);
  });

  it("writes the whole tree in one statement", async () => {
    const insert = inserted();
    siblings(() => []);

    await createFolderTree({ parentId: null, folders: [["Trip"], ["Trip", "Photos"]] });

    // Postgres checks the parent references once the statement is done, so a
    // tree that references itself can only go in as one insert.
    expect(insert).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(2);
  });

  // The cap on one request is why the provider splits a large drop at all;
  // these are the two halves of that arrangement meeting.
  it("takes each request a large drop is split into, and refuses the drop whole", async () => {
    inserted();
    siblings(() => []);
    const folders = Array.from({ length: 100 }, (_, t) => [`top-${t}`]).flatMap((top) => [
      top,
      ...Array.from({ length: 11 }, (_, c) => [...top, `sub-${c}`]),
    ]);

    // Handed over in one request, as the provider used to, a drop this size is
    // past the cap and not a folder of it is created.
    expect(await createFolderTree({ parentId: null, folders })).toEqual({
      ok: false,
      error: expect.any(String),
    });

    const batches = folderBatches(folders);
    expect(batches.length).toBeGreaterThan(1);
    for (const batch of batches)
      expect(await createFolderTree({ parentId: null, folders: batch })).toEqual({
        ok: true,
        data: expect.any(Array),
      });
  });

  it("leaves someone else's private folder of the same name alone", async () => {
    const theirs = folder({ visibility: "private", createdById: randomUUID() });
    inserted();
    siblings(() => [theirs]);

    const result = await createFolderTree({ parentId: null, folders: [["Trip"]] });

    expect(result.ok && result.data[0]).not.toBe(theirs.id);
    expect(rows).toEqual([expect.objectContaining({ name: "Trip", parentId: null })]);
  });
});

// A batch is a convenience for the network, not a unit of work: each file
// carries its own result, so one file the drive can't take must fail on its
// own and leave the others alone.
describe("a batch holding one file the drive can't take", () => {
  const ws = workspace(randomUUID(), randomUUID());

  beforeEach(() => {
    vi.mocked(requireWorkspace).mockResolvedValue(ws);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prepares the rest when one destination isn't an item id", async () => {
    vi.mocked(workspaceBucket).mockResolvedValue({
      uploadUrl: vi.fn(async (key: string) => `https://bucket.test/${key}`),
    } as never);
    usage(0);

    const result = await prepareUploads([
      { parentId: null, type: "text/plain", size: 2 },
      { parentId: "not-an-id", type: "text/plain", size: 2 },
    ]);

    expect(result).toEqual({
      ok: true,
      data: [
        { ok: true, data: { key: expect.any(String), url: expect.any(String) } },
        { ok: false, error: expect.any(String) },
      ],
    });
  });

  it("records the rest when one name is blank", async () => {
    vi.mocked(workspaceBucket).mockResolvedValue(stored() as never);
    vi.spyOn(db, "insert").mockReturnValue({
      values: () => ({
        onConflictDoNothing: () => ({ returning: async () => [{ id: randomUUID() }] }),
      }),
    } as never);

    const result = await completeUploads([
      completion(`${ws.id}/${randomUUID()}`),
      { ...completion(`${ws.id}/${randomUUID()}`), name: "   " },
    ]);

    expect(result).toEqual({
      ok: true,
      data: [
        { ok: true, data: expect.any(String) },
        { ok: false, error: expect.any(String) },
      ],
    });
  });
});

// A file the storage path can't carry is refused while it is still on the
// person's disk, and a drive that is out of room refuses the batch it can't
// hold — both before a single URL is issued, so no bytes move for either.
describe("what the drive refuses before any bytes transfer", () => {
  const ws = workspace(randomUUID(), randomUUID());
  const uploadUrl = vi.fn(async (key: string) => `https://bucket.test/${key}`);

  beforeEach(() => {
    uploadUrl.mockClear();
    vi.mocked(requireWorkspace).mockResolvedValue(ws);
    vi.mocked(workspaceBucket).mockResolvedValue({ uploadUrl } as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refuses a file above the ceiling, naming the limit", async () => {
    usage(0);

    const result = await prepareUploads([
      { parentId: null, type: "text/plain", size: MAX_UPLOAD + 1 },
    ]);

    expect(result).toEqual({
      ok: true,
      data: [{ ok: false, error: expect.stringMatching(/5 GB/) }],
    });
    expect(uploadUrl).not.toHaveBeenCalled();
  });

  it("prepares a file just below the ceiling", async () => {
    usage(0);

    const result = await prepareUploads([{ parentId: null, type: "text/plain", size: MAX_UPLOAD }]);

    expect(result).toEqual({
      ok: true,
      data: [{ ok: true, data: { key: expect.any(String), url: expect.any(String) } }],
    });
  });

  // Deliberately unlike every other check in these actions, which carry a
  // result per file: a drive that can't hold the batch takes none of it rather
  // than filling to the ceiling and failing whatever came last.
  it("refuses the whole batch when its bytes wouldn't fit", async () => {
    usage(STORAGE_QUOTA - 10);

    const result = await prepareUploads([
      { parentId: null, type: "text/plain", size: 8 },
      { parentId: null, type: "text/plain", size: 8 },
    ]);

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/space|full/i) });
    expect(uploadUrl).not.toHaveBeenCalled();
  });

  it("takes a batch that still fits after an earlier upload filled most of the drive", async () => {
    usage(STORAGE_QUOTA - 100);

    const result = await prepareUploads([
      { parentId: null, type: "text/plain", size: 8 },
      { parentId: null, type: "text/plain", size: 8 },
    ]);

    expect(result.ok && result.data.every((r) => r.ok)).toBe(true);
    expect(uploadUrl).toHaveBeenCalledTimes(2);
  });
});

// A request only ever carries the files that happened to ask for a URL at the
// same moment, which is a handful — so the drive's room has to be weighed for
// the whole drop somewhere, or a drop far past the ceiling is admitted a few
// files at a time while usage never catches up.
describe("weighing a whole drop before any of it is queued", () => {
  const ws = workspace(randomUUID(), randomUUID());

  beforeEach(() => {
    vi.mocked(requireWorkspace).mockResolvedValue(ws);
    vi.mocked(workspaceBucket).mockResolvedValue({
      uploadUrl: vi.fn(async (key: string) => `https://bucket.test/${key}`),
    } as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refuses a drop the drive can't hold, though any one request's worth fits", async () => {
    usage(STORAGE_QUOTA - 40);
    const drop = Array.from({ length: 100 }, () => 8);

    // What the request-time check sees: a few files, well inside the room left.
    const request = await prepareUploads(
      drop.slice(0, 4).map((size) => ({ parentId: null, type: "text/plain", size }))
    );
    expect(request.ok && request.data.every((r) => r.ok)).toBe(true);

    expect(await checkHeadroom(drop)).toEqual({
      ok: false,
      error: expect.stringMatching(/space|full/i),
    });
  });

  it("admits a drop that fits", async () => {
    usage(STORAGE_QUOTA - 1000);

    expect(await checkHeadroom(Array.from({ length: 100 }, () => 8))).toEqual({
      ok: true,
      data: undefined,
    });
  });

  it("asks nothing of the drive for a drop with no files", async () => {
    const used = usage(0);

    expect(await checkHeadroom([])).toEqual({ ok: true, data: undefined });
    expect(used).not.toHaveBeenCalled();
  });

  it("counts a size the client didn't really send as nothing", async () => {
    usage(STORAGE_QUOTA - 16);

    // Sizes are the client's word, so an unusable one weighs nothing rather
    // than failing a drop whose real files fit.
    expect(await checkHeadroom([8, Number.NaN, -20])).toEqual({ ok: true, data: undefined });
  });
});

// The arithmetic on its own, which is what decides whether a person can add
// anything at all.
describe("weighing a batch against the drive's ceiling", () => {
  it("lets a batch through while it fits exactly", () => {
    expect(headroomRefusal(90, 10, 100)).toBeNull();
  });

  it("refuses one byte past the ceiling, saying how much room is left", () => {
    const refusal = headroomRefusal(90, 11, 100);

    expect(refusal).toMatch(/10 B/);
    expect(refusal).toMatch(/space|full/i);
  });

  it("refuses a drive already at its ceiling", () => {
    expect(headroomRefusal(100, 1, 100)).not.toBeNull();
    expect(headroomRefusal(200, 1, 100)).not.toBeNull();
  });
});

// An object that reached storage and then failed to be recorded is bytes
// nobody can reach. The orphan sweep is the backstop for what slips past;
// a rejection the action makes itself cleans up after itself.
describe("an upload the drive won't record", () => {
  const ws = workspace(randomUUID(), randomUUID());

  beforeEach(() => {
    vi.mocked(requireWorkspace).mockResolvedValue(ws);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("removes an object too large to keep", async () => {
    const bucket = stored(MAX_UPLOAD + 1);
    vi.mocked(workspaceBucket).mockResolvedValue(bucket as never);
    const key = `${ws.id}/${randomUUID()}`;

    const result = await completeUploads([completion(key)]);

    expect(result).toEqual({
      ok: true,
      data: [{ ok: false, error: expect.stringMatching(/5 GB/) }],
    });
    expect(bucket.remove).toHaveBeenCalledWith([key]);
  });

  it("leaves an object belonging to another drive where it is", async () => {
    const bucket = stored();
    vi.mocked(workspaceBucket).mockResolvedValue(bucket as never);

    await completeUploads([completion(`${randomUUID()}/${randomUUID()}`)]);

    expect(bucket.remove).not.toHaveBeenCalled();
  });

  it("keeps the object of an upload that was already recorded", async () => {
    const bucket = stored();
    vi.mocked(workspaceBucket).mockResolvedValue(bucket as never);
    vi.spyOn(db, "insert").mockReturnValue({
      values: () => ({ onConflictDoNothing: () => ({ returning: async () => [] }) }),
    } as never);
    vi.spyOn(db, "select").mockReturnValue({
      from: () => ({ where: async () => [{ id: randomUUID() }] }),
    } as never);

    const result = await completeUploads([completion(`${ws.id}/${randomUUID()}`)]);

    expect(result).toEqual({ ok: true, data: [{ ok: true, data: expect.any(String) }] });
    expect(bucket.remove).not.toHaveBeenCalled();
  });
});

// What the unique constraint does is exactly what a stub can't show: these
// need TEST_DATABASE_URL pointed at a migrated branch.
describeDb("uploads against the database", () => {
  let ws: Workspace;

  beforeEach(async () => {
    const [user] = await db
      .insert(users)
      .values({ name: "Test Person", email: `${randomUUID()}@example.test` })
      .returning({ id: users.id });
    const [org] = await db
      .insert(organizations)
      .values({ name: "Test drive", slug: `test-${randomUUID()}`, kind: "personal" })
      .returning({ id: organizations.id });
    await db.insert(members).values({ organizationId: org.id, userId: user.id, role: "owner" });
    ws = workspace(org.id, user.id);
    vi.mocked(requireWorkspace).mockResolvedValue(ws);
    vi.mocked(workspaceBucket).mockResolvedValue(stored() as never);
  });

  afterEach(async () => {
    // Items and membership cascade from the organization.
    await db.delete(organizations).where(eq(organizations.id, ws.id));
    await db.delete(users).where(eq(users.id, ws.userId));
    vi.restoreAllMocks();
  });

  const all = () =>
    db
      .select({
        id: driveItems.id,
        name: driveItems.name,
        parentId: driveItems.parentId,
        storageKey: driveItems.storageKey,
      })
      .from(driveItems)
      .where(eq(driveItems.organizationId, ws.id));

  it("records a replayed completion once, answering the same both times", async () => {
    const file = completion(`${ws.id}/${randomUUID()}`);

    const first = await completeUploads([file]);
    const second = await completeUploads([file]);

    expect(first).toEqual({ ok: true, data: [{ ok: true, data: expect.any(String) }] });
    expect(second).toEqual(first);
    expect(await all()).toHaveLength(1);
  });

  it("lets folders, which have no storage key, sit side by side", async () => {
    const result = await createFolderTree({
      parentId: null,
      folders: [["Trip"], ["Photos"], ["Notes"]],
    });

    expect(result.ok).toBe(true);
    const rows = await all();
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.storageKey === null)).toBe(true);
  });

  it("refuses a storage key belonging to another drive", async () => {
    const result = await completeUploads([completion(`${randomUUID()}/${randomUUID()}`)]);

    expect(result).toEqual({
      ok: true,
      data: [{ ok: false, error: expect.stringMatching(/invalid upload/i) }],
    });
    expect(await all()).toHaveLength(0);
  });

  it("lands a repeated folder drop inside the tree that is already there", async () => {
    const drop = { parentId: null, folders: [["Trip"], ["Trip", "Photos"]] };

    const first = await createFolderTree(drop);
    const second = await createFolderTree(drop);

    expect(first.ok && second.ok && second.data).toEqual(first.ok ? first.data : []);
    expect(await all()).toHaveLength(2);
  });

  it("refuses a batch the drive has no room for, and takes one it has room for", async () => {
    const roomy = await prepareUploads([{ parentId: null, type: "text/plain", size: 1 }]);
    expect(roomy.ok).toBe(true);

    // One file already filling the drive to its ceiling.
    await db.insert(driveItems).values({
      organizationId: ws.id,
      kind: "document",
      name: "Big.bin",
      size: STORAGE_QUOTA,
      storageKey: `${ws.id}/${randomUUID()}`,
      createdById: ws.userId,
    });

    const result = await prepareUploads([{ parentId: null, type: "text/plain", size: 1 }]);

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/space|full/i) });
  });

  it("leaves the bytes of a file it refused to record out of the bucket", async () => {
    const bucket = stored(MAX_UPLOAD + 1);
    vi.mocked(workspaceBucket).mockResolvedValue(bucket as never);
    const key = `${ws.id}/${randomUUID()}`;

    const result = await completeUploads([completion(key)]);

    expect(result).toEqual({
      ok: true,
      data: [{ ok: false, error: expect.stringMatching(/5 GB/) }],
    });
    expect(bucket.remove).toHaveBeenCalledWith([key]);
    expect(await all()).toHaveLength(0);
  });

  it("keeps two folders the client kept apart apart, each with its own children", async () => {
    const result = await createFolderTree({
      parentId: null,
      folders: [[" Trip "], ["Trip"], [" Trip ", "Photos"], ["Trip", "Notes"]],
    });

    expect(result.ok).toBe(true);
    const ids = result.ok ? result.data : [];
    const rows = await all();
    expect(rows).toHaveLength(4);
    expect(rows.find((r) => r.name === "Photos")?.parentId).toBe(ids[0]);
    expect(rows.find((r) => r.name === "Notes")?.parentId).toBe(ids[1]);
  });
});
