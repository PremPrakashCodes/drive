import type { NewDriveItem } from "@/db/schema";
import type { Workspace } from "@/types";
import type { SQL } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { driveItems, members, organizations, users } from "@/db/schema";
import { createFolderTree } from "@/lib/drive/items";
import { workspaceBucket } from "@/lib/drive/s3";
import { completeUploads } from "@/lib/drive/uploads";
import { requireWorkspace } from "@/lib/drive/workspace";
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
const stored = () => ({
  head: vi.fn(async () => ({ ContentLength: 2 })),
  peekBytes: vi.fn(async () => new TextEncoder().encode("hi")),
});

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

  it("leaves someone else's private folder of the same name alone", async () => {
    const theirs = folder({ visibility: "private", createdById: randomUUID() });
    inserted();
    siblings(() => [theirs]);

    const result = await createFolderTree({ parentId: null, folders: [["Trip"]] });

    expect(result.ok && result.data[0]).not.toBe(theirs.id);
    expect(rows).toEqual([expect.objectContaining({ name: "Trip", parentId: null })]);
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
