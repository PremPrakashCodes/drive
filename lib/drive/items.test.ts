import type { DriveItem, NewDriveItem } from "@/db/schema";
import type { Workspace } from "@/types";
import { eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { driveItems, members, organizations, users } from "@/db/schema";
import { destination, selection } from "@/lib/drive/item-queries";
import { moveItems, restoreItems } from "@/lib/drive/items";
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
  };
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
});
