import type { DriveItem, NewDriveItem } from "@/db/schema";
import type { Workspace } from "@/types";
import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { driveItems, driveStars, members, organizations, users } from "@/db/schema";
import { selection } from "@/lib/drive/item-queries";
import { lockItems, unlockItems } from "@/lib/drive/locked-items";
import { getSpaceLock, lockedFolderOpen } from "@/lib/drive/unlock";
import { requireWorkspace } from "@/lib/drive/workspace";
import { describeDb } from "@/test/db";

// The request-scoped pieces — the session, the cookies behind the Locked
// folder's PIN — stand in for; the checks and the writes stay real.
vi.mock("@/lib/drive/workspace", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/drive/workspace")>();
  return { ...actual, requireWorkspace: vi.fn(actual.requireWorkspace) };
});
vi.mock("@/lib/drive/unlock", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/drive/unlock")>();
  return {
    ...actual,
    getSpaceLock: vi.fn(actual.getSpaceLock),
    lockedFolderOpen: vi.fn(actual.lockedFolderOpen),
  };
});
vi.mock("@/lib/drive/item-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/drive/item-queries")>();
  return { ...actual, selection: vi.fn(actual.selection) };
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

// One round-trip, asserted without a database: DATABASE_URL points at an
// unroutable host in tests, so a statement sent outside the stubbed
// `db.batch` would reject and `run` would report the failure.
describe("Locked folder mutations", () => {
  const ws = workspace(randomUUID(), randomUUID());

  beforeEach(() => {
    vi.mocked(requireWorkspace).mockResolvedValue(ws);
    vi.mocked(getSpaceLock).mockResolvedValue({
      userId: ws.userId,
      organizationId: ws.id,
      secretHash: "hash",
      failedAttempts: 0,
      retryAfter: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hides, detaches and unstars in one batch", async () => {
    const folder = row(ws, { kind: "folder", name: "Trip" });
    const child = row(ws, { parentId: folder.id });
    vi.mocked(selection).mockResolvedValue({ roots: [folder], below: [child] });
    const batch = vi.spyOn(db, "batch").mockResolvedValue([] as never);

    await expect(lockItems([folder.id])).resolves.toEqual({ ok: true, data: undefined });
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0][0]).toHaveLength(3);
  });

  it("detaches and unlocks in one batch", async () => {
    const lockedAt = new Date();
    const folder = row(ws, { kind: "folder", name: "Trip", lockedAt, visibility: "private" });
    const child = row(ws, { parentId: folder.id, lockedAt, visibility: "private" });
    vi.mocked(selection).mockResolvedValue({ roots: [folder], below: [child] });
    const batch = vi.spyOn(db, "batch").mockResolvedValue([] as never);

    await expect(unlockItems([folder.id])).resolves.toEqual({ ok: true, data: undefined });
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0][0]).toHaveLength(2);
  });

  it("refuses a folder with a trashed item inside, naming it", async () => {
    // Locked and trashed at once is invisible everywhere: the Locked page
    // shows only what isn't trashed, and Trash shows only what isn't locked.
    const folder = row(ws, { kind: "folder", name: "Trip" });
    const child = row(ws, { parentId: folder.id, name: "Beach.jpg", trashedAt: new Date() });
    vi.mocked(selection).mockResolvedValue({ roots: [folder], below: [child] });
    const batch = vi.spyOn(db, "batch").mockResolvedValue([] as never);

    const result = await lockItems([folder.id]);

    expect(result).toEqual({ ok: false, error: expect.stringContaining("Beach.jpg") });
    expect(batch).not.toHaveBeenCalled();
  });

  it("locks a subtree larger than one statement can bind, in one batch", async () => {
    const folder = row(ws, { kind: "folder", name: "Trip" });
    const below = Array.from({ length: 600 }, () => row(ws, { parentId: folder.id }));
    vi.mocked(selection).mockResolvedValue({ roots: [folder], below });
    const batch = vi.spyOn(db, "batch").mockResolvedValue([] as never);

    await expect(lockItems([folder.id])).resolves.toEqual({ ok: true, data: undefined });

    // Still one batch — 601 items split across two hide statements and two
    // unstar statements, plus the one that takes the root out of its folder.
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0][0]).toHaveLength(5);
  });

  it("reports a failed lock instead of half-applying it", async () => {
    const folder = row(ws, { kind: "folder", name: "Trip" });
    vi.mocked(selection).mockResolvedValue({ roots: [folder], below: [] });
    vi.spyOn(db, "batch").mockRejectedValue(new Error("statement failed"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect((await lockItems([folder.id])).ok).toBe(false);
  });
});

describeDb("Locked folder mutations against the database", () => {
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
    // A PIN is set up, and the folder is open for this request.
    vi.mocked(getSpaceLock).mockResolvedValue({
      userId: ws.userId,
      organizationId: ws.id,
      secretHash: "hash",
      failedAttempts: 0,
      retryAfter: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(lockedFolderOpen).mockResolvedValue(Date.now() + 60_000);
  });

  afterEach(async () => {
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
            lockedAt: driveItems.lockedAt,
          })
          .from(driveItems)
          .where(inArray(driveItems.id, ids))
      ).map((r) => [r.id, r])
    );

  it("locks a subtree, detaches its root and drops its stars together", async () => {
    const folder = await insert({ kind: "folder", name: "Trip" });
    const child = await insert({ parentId: folder });
    await db.insert(driveStars).values({ userId: ws.userId, itemId: folder });

    await expect(lockItems([folder])).resolves.toEqual({ ok: true, data: undefined });

    const after = await read([folder, child]);
    expect(after.get(folder)).toMatchObject({ parentId: null, visibility: "private" });
    expect(after.get(folder)?.lockedAt).not.toBeNull();
    expect(after.get(child)).toMatchObject({ parentId: folder, visibility: "private" });
    expect(after.get(child)?.lockedAt).not.toBeNull();
    const stars = await db
      .select({ itemId: driveStars.itemId })
      .from(driveStars)
      .where(and(eq(driveStars.userId, ws.userId), eq(driveStars.itemId, folder)));
    expect(stars).toHaveLength(0);
  });

  it("unlocks a subtree back to the top level", async () => {
    const lockedAt = new Date();
    const folder = await insert({ kind: "folder", name: "Trip", lockedAt, visibility: "private" });
    const child = await insert({ parentId: folder, lockedAt, visibility: "private" });

    await expect(unlockItems([folder])).resolves.toEqual({ ok: true, data: undefined });

    const after = await read([folder, child]);
    expect(after.get(folder)).toMatchObject({ parentId: null, lockedAt: null });
    expect(after.get(child)).toMatchObject({ parentId: folder, lockedAt: null });
  });
});
