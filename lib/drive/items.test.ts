import type { DriveItem, NewDriveItem } from "@/db/schema";
import type { Workspace } from "@/types";
import type { SQL } from "drizzle-orm";
import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { driveItems, members, organizations, users } from "@/db/schema";
import { MAX_TREE_DEPTH } from "@/lib/drive/action";
import { descendants, destination, load, selection } from "@/lib/drive/item-queries";
import { copyItems, deleteItems, moveItems, restoreItems, setVisibility } from "@/lib/drive/items";
import { workspaceBucket } from "@/lib/drive/s3";
import { requireWorkspace } from "@/lib/drive/workspace";
import { describeDb } from "@/test/db";

// `requireWorkspace` reads cookies and the session, and `selection` /
// `destination` are the reads a mutation does before it writes. Standing in
// for them is what lets these actions run outside a request; everything else
// — the checks and the writes — stays the real module.
vi.mock("@/lib/drive/workspace", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/drive/workspace")>();
  return { ...actual, requireWorkspace: vi.fn(actual.requireWorkspace) };
});
vi.mock("@/lib/drive/item-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/drive/item-queries")>();
  return {
    ...actual,
    selection: vi.fn(actual.selection),
    destination: vi.fn(actual.destination),
    load: vi.fn(actual.load),
    descendants: vi.fn(actual.descendants),
  };
});
vi.mock("@/lib/drive/s3", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/drive/s3")>();
  return { ...actual, workspaceBucket: vi.fn(actual.workspaceBucket) };
});

const real = await vi.importActual<typeof import("@/lib/drive/item-queries")>(
  "@/lib/drive/item-queries"
);

const workspace = (id: string, userId: string): Workspace => ({
  id,
  name: "Test drive",
  role: "owner",
  userId,
  own: true,
  kind: "personal",
});

// Every column, so these stand in for rows `selection` would have read.
const row = (ws: Workspace, over: Partial<DriveItem> = {}): DriveItem => ({
  id: randomUUID(),
  organizationId: ws.id,
  parentId: null,
  kind: "document",
  name: "Report.pdf",
  size: 0,
  mimeType: null,
  storageKey: null,
  visibility: "shared",
  color: null,
  createdById: ws.userId,
  trashedAt: null,
  lockedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

// One round-trip, asserted without a database. `test/setup.ts` points
// DATABASE_URL at an unroutable host, so any statement sent outside the
// stubbed `db.batch` would reject and `run` would report the failure —
// an `ok: true` result with `batch` stubbed means nothing else was sent.
describe("multi-statement mutations", () => {
  const ws = workspace(randomUUID(), randomUUID());

  beforeEach(() => {
    vi.mocked(requireWorkspace).mockResolvedValue(ws);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("moves into a private folder in one batch", async () => {
    const folder = row(ws, { kind: "folder", name: "Trip" });
    const child = row(ws, { parentId: folder.id });
    const target = row(ws, { kind: "folder", name: "Private", visibility: "private" });
    vi.mocked(selection).mockResolvedValue({ roots: [folder], below: [child] });
    vi.mocked(destination).mockResolvedValue(target);
    const batch = vi.spyOn(db, "batch").mockResolvedValue([] as never);

    await expect(moveItems([folder.id], target.id)).resolves.toEqual({
      ok: true,
      data: undefined,
    });
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0][0]).toHaveLength(2);
  });

  it("reports a failed move instead of half-applying it", async () => {
    const folder = row(ws, { kind: "folder", name: "Trip" });
    const target = row(ws, { kind: "folder", name: "Private", visibility: "private" });
    vi.mocked(selection).mockResolvedValue({ roots: [folder], below: [] });
    vi.mocked(destination).mockResolvedValue(target);
    vi.spyOn(db, "batch").mockRejectedValue(new Error("statement failed"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await moveItems([folder.id], target.id);
    expect(result.ok).toBe(false);
  });

  it("restores and re-parents an orphan in one batch", async () => {
    const folder = row(ws, { kind: "folder", name: "Trip", trashedAt: new Date() });
    const item = row(ws, { parentId: folder.id, trashedAt: new Date() });
    vi.mocked(selection).mockResolvedValue({ roots: [item], below: [] });
    // The only read between the two writes: are the roots' parents trashed?
    vi.spyOn(db, "select").mockReturnValue({
      from: () => ({ where: async () => [{ id: folder.id, trashedAt: folder.trashedAt }] }),
    } as never);
    const batch = vi.spyOn(db, "batch").mockResolvedValue([] as never);

    await expect(restoreItems([item.id])).resolves.toEqual({ ok: true, data: undefined });
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0][0]).toHaveLength(2);
  });
});

// Which of the two stores is written first decides what a partial failure
// leaves behind. Rows first: a failure leaves objects no row references, which
// the sweeper reclaims. Objects first: a failure leaves rows pointing at bytes
// that no longer exist — a file the drive still lists and can never open.
describe("storage-write ordering", () => {
  const ws = workspace(randomUUID(), randomUUID());
  // What each store was asked to do, in the order it was asked.
  let order: string[];
  let remove: ReturnType<typeof vi.fn>;
  let copy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    order = [];
    vi.mocked(requireWorkspace).mockResolvedValue(ws);
    vi.spyOn(console, "error").mockImplementation(() => {});
    remove = vi.fn(async () => {
      order.push("objects");
    });
    copy = vi.fn(async () => {
      order.push("objects");
    });
    vi.mocked(workspaceBucket).mockResolvedValue({ remove, copy } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const deletable = () => row(ws, { storageKey: `${ws.id}/object`, trashedAt: new Date() });

  it("deletes the rows before removing the objects", async () => {
    const file = deletable();
    vi.mocked(selection).mockResolvedValue({ roots: [file], below: [] });
    vi.spyOn(db, "delete").mockImplementation((() => ({
      where: async () => {
        order.push("rows");
      },
    })) as never);

    await expect(deleteItems([file.id])).resolves.toEqual({ ok: true, data: undefined });
    expect(order).toEqual(["rows", "objects"]);
  });

  it("leaves unreferenced objects, never rows without bytes, when removal fails", async () => {
    const file = deletable();
    vi.mocked(selection).mockResolvedValue({ roots: [file], below: [] });
    vi.spyOn(db, "delete").mockImplementation((() => ({
      where: async () => {
        order.push("rows");
      },
    })) as never);
    remove.mockRejectedValue(new Error("bucket unreachable"));

    // The rows are gone, so the deletion the person asked for happened; the
    // bytes left over are the sweeper's to reclaim.
    await expect(deleteItems([file.id])).resolves.toEqual({ ok: true, data: undefined });
    expect(order).toEqual(["rows"]);
  });

  it("keeps the objects when the row delete fails", async () => {
    const file = deletable();
    vi.mocked(selection).mockResolvedValue({ roots: [file], below: [] });
    vi.spyOn(db, "delete").mockImplementation((() => ({
      where: async () => {
        throw new Error("statement failed");
      },
    })) as never);

    const result = await deleteItems([file.id]);
    expect(result.ok).toBe(false);
    expect(remove).not.toHaveBeenCalled();
  });

  it("copies the objects before inserting the rows that name them", async () => {
    const file = row(ws, { storageKey: `${ws.id}/object` });
    vi.mocked(selection).mockResolvedValue({ roots: [file], below: [] });
    vi.mocked(destination).mockResolvedValue(null);
    vi.spyOn(db, "insert").mockReturnValue({
      values: async () => {
        order.push("rows");
      },
    } as never);

    await expect(copyItems([file.id], null)).resolves.toEqual({ ok: true, data: undefined });
    expect(order).toEqual(["objects", "rows"]);
  });
});

// Drizzle renders a condition to SQL plus its bind parameters; reading them
// back is how a stub sees which rows a query would have matched.
const bindings = (condition: SQL) =>
  (
    db as unknown as { dialect: { sqlToQuery(sql: SQL): { params: unknown[] } } }
  ).dialect.sqlToQuery(condition).params as string[];

// Sharing an item means climbing to the top of its folders: a private one
// anywhere above it keeps it private. What that climb reads decides the answer.
describe("the folders above an item being shared", () => {
  const ws = workspace(randomUUID(), randomUUID());
  let reads: string[][];

  // Answers the ancestor query with `rows`, recording what it was asked for.
  const ancestors = (rows: (condition: string[]) => unknown[]) =>
    vi.spyOn(db, "select").mockImplementation((() => ({
      from: () => ({
        where: async (condition: SQL) => {
          const params = bindings(condition);
          reads.push(params);
          return rows(params);
        },
      }),
    })) as never);

  beforeEach(() => {
    reads = [];
    vi.mocked(requireWorkspace).mockResolvedValue(ws);
    vi.mocked(descendants).mockResolvedValue([]);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("says so when the folder it sits in is gone", async () => {
    const item = row(ws, { parentId: randomUUID() });
    vi.mocked(load).mockResolvedValue([item]);
    ancestors(() => []);

    const result = await setVisibility(item.id, "shared");

    // A stated answer, not "Something went wrong": the row it needed is gone.
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/no longer exists/i) });
  });

  it("looks for those folders in the caller's own workspace", async () => {
    // Without the filter, a row in someone else's drive — which the parent
    // reference alone doesn't rule out — would decide whether this can be shared.
    const parent = row(ws, { kind: "folder", organizationId: randomUUID() });
    const item = row(ws, { parentId: parent.id });
    vi.mocked(load).mockResolvedValue([item]);
    ancestors((params) => (params.includes(ws.id) ? [] : [parent]));

    const result = await setVisibility(item.id, "shared");

    expect(reads[0]).toContain(ws.id);
    expect(result.ok).toBe(false);
  });

  it("gives up on a folder chain that never reaches the top", async () => {
    // A cycle among the folders above it: every read has another parent.
    const item = row(ws, { parentId: randomUUID() });
    vi.mocked(load).mockResolvedValue([item]);
    ancestors(() => {
      if (reads.length > 1000) throw new Error("the climb never finished");
      return [{ parentId: randomUUID(), visibility: "shared" }];
    });

    const result = await setVisibility(item.id, "shared");

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/nested too deeply/i) });
    expect(reads.length).toBeLessThanOrEqual(MAX_TREE_DEPTH);
  });

  it("writes a subtree larger than one statement can bind in one batch", async () => {
    const folder = row(ws, { kind: "folder", name: "Trip" });
    vi.mocked(load).mockResolvedValue([folder]);
    vi.mocked(descendants).mockResolvedValue(
      Array.from({ length: 600 }, () => row(ws, { parentId: folder.id }))
    );
    const batch = vi.spyOn(db, "batch").mockResolvedValue([] as never);

    await expect(setVisibility(folder.id, "private")).resolves.toEqual({
      ok: true,
      data: undefined,
    });
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0][0]).toHaveLength(2);
  });
});

describeDb("item mutations against the database", () => {
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
    vi.mocked(selection).mockImplementation(real.selection);
    vi.mocked(destination).mockImplementation(real.destination);
  });

  afterEach(async () => {
    // Items and membership cascade from the organization.
    await db.delete(organizations).where(eq(organizations.id, ws.id));
    await db.delete(users).where(eq(users.id, ws.userId));
    vi.restoreAllMocks();
  });

  const insert = (over: Partial<NewDriveItem>) =>
    db
      .insert(driveItems)
      .values({
        organizationId: ws.id,
        kind: "document",
        name: "Report.pdf",
        createdById: ws.userId,
        ...over,
      })
      .returning({ id: driveItems.id })
      .then(([r]) => r.id);

  const read = async (ids: string[]) =>
    new Map(
      (
        await db
          .select({
            id: driveItems.id,
            parentId: driveItems.parentId,
            visibility: driveItems.visibility,
            trashedAt: driveItems.trashedAt,
          })
          .from(driveItems)
          .where(inArray(driveItems.id, ids))
      ).map((r) => [r.id, r])
    );

  it("marks a moved subtree private and re-parents its root together", async () => {
    const target = await insert({ kind: "folder", name: "Private", visibility: "private" });
    const folder = await insert({ kind: "folder", name: "Trip" });
    const child = await insert({ parentId: folder });

    await expect(moveItems([folder], target)).resolves.toEqual({ ok: true, data: undefined });

    const after = await read([folder, child]);
    expect(after.get(folder)).toMatchObject({ parentId: target, visibility: "private" });
    expect(after.get(child)).toMatchObject({ parentId: folder, visibility: "private" });
  });

  it("leaves visibility untouched when the re-parent fails", async () => {
    const folder = await insert({ kind: "folder", name: "Trip" });
    const child = await insert({ parentId: folder });
    // A private destination that no longer exists: the re-parent violates the
    // parent foreign key, while the statement before it would have succeeded.
    vi.mocked(destination).mockResolvedValue(
      row(ws, { kind: "folder", name: "Gone", visibility: "private" })
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await moveItems([folder], randomUUID());
    expect(result.ok).toBe(false);

    const after = await read([folder, child]);
    expect(after.get(folder)).toMatchObject({ parentId: null, visibility: "shared" });
    expect(after.get(child)).toMatchObject({ parentId: folder, visibility: "shared" });
  });

  it("restores an item under a trashed folder to the top level", async () => {
    const trashedAt = new Date();
    const folder = await insert({ kind: "folder", name: "Trip", trashedAt });
    const child = await insert({ parentId: folder, trashedAt });

    await expect(restoreItems([child])).resolves.toEqual({ ok: true, data: undefined });

    const after = await read([folder, child]);
    expect(after.get(child)).toMatchObject({ parentId: null, trashedAt: null });
    expect(after.get(folder)?.trashedAt).not.toBeNull();
  });

  it("copies a folder selected together with a folder inside it", async () => {
    // Both end up selected easily — a flat screen lists them side by side.
    // The subfolder used to come back from the walk twice, and the copy then
    // failed on its own primary key.
    const folder = await insert({ kind: "folder", name: "Trip" });
    const subfolder = await insert({ kind: "folder", name: "Photos", parentId: folder });
    await insert({ parentId: subfolder, name: "Beach.jpg" });

    await expect(copyItems([folder, subfolder], null)).resolves.toEqual({
      ok: true,
      data: undefined,
    });

    const all = await db
      .select({ id: driveItems.id })
      .from(driveItems)
      .where(eq(driveItems.organizationId, ws.id));
    // The three originals, plus one copy of each.
    expect(all).toHaveLength(6);
  });
});
