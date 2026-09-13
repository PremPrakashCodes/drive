"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  driveItems,
  driveStars,
  members,
  organizations,
  storageConnections,
  storageProviders,
  users,
  type DriveItem,
  type DriveItemKind,
  type DriveItemVisibility,
} from "@/db/schema";
import { detectFile, HEAD_BYTES } from "@/lib/workspace/detect";
import { Id, parse, run } from "@/lib/drive/action";
import { workspaceBucket } from "@/lib/drive/s3";
import type { ActionResult, DriveListing } from "@/lib/drive/types";
import {
  activeUnlock,
  getSpaceLock,
  lockedFolderOpen,
} from "@/lib/drive/unlock";
import {
  canEdit,
  canRead,
  DriveError,
  requireUser,
  requireWorkspace,
  WORKSPACE_COOKIE,
  type Workspace,
} from "@/lib/drive/workspace";

const Ids = z.array(Id).min(1).max(500);
const Name = z
  .string()
  .trim()
  .min(1, "Enter a name.")
  .max(255, "Names can be up to 255 characters.")
  .refine((v) => !/[\x00-\x1f/\\]/.test(v), "Names can't contain / or \\.");

// Loads items by id. Items the caller can't read are treated as missing, so
// a private item's existence never leaks.
async function load(ws: Workspace, ids: string[]) {
  const rows = await db
    .select()
    .from(driveItems)
    .where(
      and(eq(driveItems.organizationId, ws.id), inArray(driveItems.id, ids)),
    );
  // Your Locked folder's items need it unlocked; anyone else's stay missing.
  const locked = rows.some((r) => r.lockedAt && r.createdById === ws.userId);
  const open = locked && (await lockedFolderOpen(ws.userId, ws.id)) !== null;
  if (locked && !open)
    throw new DriveError(
      "Your Locked folder is locked. Enter your PIN to open it.",
    );
  const visible = rows.filter((r) => canRead(r, ws.userId, open));
  if (visible.length !== new Set(ids).size)
    throw new DriveError("Some of these items no longer exist.");
  return visible;
}

// All descendants of `ids` (readable or not), breadth-first.
async function descendants(ws: Workspace, ids: string[]) {
  const found: DriveItem[] = [];
  for (let frontier = ids; frontier.length;) {
    const rows = await db
      .select()
      .from(driveItems)
      .where(
        and(
          eq(driveItems.organizationId, ws.id),
          inArray(driveItems.parentId, frontier),
        ),
      );
    found.push(...rows);
    frontier = rows.map((r) => r.id);
  }
  return found;
}

// Selected items, minus any nested inside another selected folder.
async function selection(ws: Workspace, ids: string[]) {
  const items = await load(ws, ids);
  const below = await descendants(ws, ids);
  const nested = new Set(below.map((i) => i.id));
  return { roots: items.filter((i) => !nested.has(i.id)), below };
}

async function destination(ws: Workspace, id: string | null) {
  if (!id) return null;
  const [folder] = await load(ws, [id]);
  if (folder.kind !== "folder" || folder.trashedAt)
    throw new DriveError("That folder isn't available.");
  return folder; // readable, so a private folder is always the caller's
}

// Items inside a private folder are private too.
const visibilityIn = (
  parent: DriveItem | null,
  requested: DriveItemVisibility,
): DriveItemVisibility =>
  parent?.visibility === "private" ? "private" : requested;

// Where new folders and uploads go. Inside the Locked folder (its top level,
// or any folder in it) they're locked and private too. Adding at the top level
// needs only a PIN, since it reveals nothing; a locked parent needs an unlock.
async function placement(
  ws: Workspace,
  parentId: string | null,
  locked: boolean,
) {
  const parent = await destination(ws, parentId);
  if (locked && parent && !parent.lockedAt)
    throw new DriveError("That folder isn't in your Locked folder.");
  const inLocked = locked || Boolean(parent?.lockedAt);
  if (inLocked && !parent && !(await getSpaceLock(ws.userId, ws.id)))
    throw new DriveError("Set up your Locked folder first.");
  return {
    parent,
    lockedAt: inLocked ? new Date() : null,
    visibility: (requested: DriveItemVisibility): DriveItemVisibility =>
      inLocked ? "private" : visibilityIn(parent, requested),
  };
}

export async function getDrive(): Promise<ActionResult<DriveListing>> {
  return run(async () => {
    const ws = await requireWorkspace();
    const lock = await getSpaceLock(ws.userId, ws.id);
    const unlockedUntil = lock && (await activeUnlock(lock));
    const [rows, spaces, [storage]] = await Promise.all([
      db
        .select({
          item: driveItems,
          createdByName: users.name,
          starred: driveStars.itemId,
        })
        .from(driveItems)
        .innerJoin(users, eq(users.id, driveItems.createdById))
        .leftJoin(
          driveStars,
          and(
            eq(driveStars.itemId, driveItems.id),
            eq(driveStars.userId, ws.userId),
          ),
        )
        .where(
          and(
            eq(driveItems.organizationId, ws.id),
            or(
              eq(driveItems.visibility, "shared"),
              eq(driveItems.createdById, ws.userId),
            ),
            // Locked-folder items (always yours) only while it's unlocked.
            unlockedUntil ? undefined : isNull(driveItems.lockedAt),
          ),
        ),
      db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
        })
        .from(members)
        .innerJoin(organizations, eq(organizations.id, members.organizationId))
        .where(
          and(
            eq(members.userId, ws.userId),
            eq(organizations.kind, "personal"),
          ),
        )
        .orderBy(asc(organizations.name)),
      db
        .select({
          provider: storageProviders.name,
          config: storageConnections.config,
        })
        .from(storageConnections)
        .innerJoin(
          storageProviders,
          eq(storageProviders.id, storageConnections.providerId),
        )
        .where(eq(storageConnections.organizationId, ws.id))
        .limit(1),
    ]);
    return {
      workspace: {
        id: ws.id,
        name: ws.name,
        role: ws.role,
        own: ws.own,
        userId: ws.userId,
      },
      lockedFolder: {
        hasPin: lock !== null,
        expiresIn: unlockedUntil ? unlockedUntil - Date.now() : null,
      },
      spaces: spaces
        .map((s) => ({
          id: s.id,
          name: s.name,
          own: s.slug === `personal-${ws.userId}`,
        }))
        .sort((a, b) => Number(b.own) - Number(a.own)),
      items: rows.map(({ item, createdByName, starred }) => ({
        id: item.id,
        name: item.name,
        kind: item.kind,
        size: item.size,
        mimeType: item.mimeType,
        parentId: item.parentId,
        visibility: item.visibility,
        color: item.color,
        createdById: item.createdById,
        createdByName,
        starred: starred !== null,
        canEdit: canEdit(item, ws),
        locked: item.lockedAt !== null,
        trashedAt: item.trashedAt?.toISOString() ?? null,
        updatedAt: item.updatedAt.toISOString(),
      })),
      storage: storage
        ? {
            connected: true,
            provider: storage.provider,
            bucket: storage.config.bucket,
            region: storage.config.region ?? null,
            endpoint: storage.config.endpoint ?? null,
          }
        : { connected: false },
    };
  });
}

export async function switchSpace(id: string): Promise<ActionResult> {
  return run(async () => {
    const user = await requireUser();
    const spaceId = parse(Id, id);
    const [membership] = await db
      .select({ id: members.id })
      .from(members)
      .innerJoin(organizations, eq(organizations.id, members.organizationId))
      .where(
        and(
          eq(members.userId, user.id),
          eq(members.organizationId, spaceId),
          eq(organizations.kind, "personal"),
        ),
      );
    if (!membership) throw new DriveError("You're not a member of that drive.");
    (await cookies()).set(WORKSPACE_COOKIE, spaceId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  });
}

export async function createFolder(input: {
  name: string;
  parentId: string | null;
  private: boolean;
  // Create at the Locked folder's top level when parentId is null.
  locked?: boolean;
}): Promise<ActionResult<string>> {
  return run(async () => {
    const ws = await requireWorkspace();
    const data = parse(
      z.object({
        name: Name,
        parentId: Id.nullable(),
        private: z.boolean(),
        locked: z.boolean().default(false),
      }),
      input,
    );
    const place = await placement(ws, data.parentId, data.locked);
    const [row] = await db
      .insert(driveItems)
      .values({
        organizationId: ws.id,
        parentId: place.parent?.id ?? null,
        kind: "folder",
        name: data.name,
        color: "green",
        visibility: place.visibility(data.private ? "private" : "shared"),
        lockedAt: place.lockedAt,
        createdById: ws.userId,
      })
      .returning({ id: driveItems.id });
    return row.id;
  });
}

export async function renameItem(
  id: string,
  name: string,
): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    const [item] = await load(ws, [parse(Id, id)]);
    if (!canEdit(item, ws))
      throw new DriveError("Only the person who added this can rename it.");
    await db
      .update(driveItems)
      .set({ name: parse(Name, name) })
      .where(eq(driveItems.id, item.id));
  });
}

export async function moveItems(
  ids: string[],
  parentId: string | null,
): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    const { roots, below } = await selection(ws, parse(Ids, ids));
    const target = await destination(ws, parentId && parse(Id, parentId));
    const tree = [...roots, ...below];
    if (target && tree.some((i) => i.id === target.id))
      throw new DriveError("A folder can't be moved inside itself.");
    // Moves stay on one side: within the Locked folder (where no target means
    // its top level) or outside it. Crossing over has its own actions.
    const locked = Boolean(roots[0]?.lockedAt);
    if (
      roots.some((i) => Boolean(i.lockedAt) !== locked) ||
      (target && Boolean(target.lockedAt) !== locked)
    )
      throw new DriveError(
        locked
          ? "Use “Move out of Locked folder” to take files out."
          : "Use “Move to Locked folder” to hide files.",
      );
    if (!roots.every((i) => canEdit(i, ws)))
      throw new DriveError("You can only move items you added.");
    if (target?.visibility === "private") {
      if (tree.some((i) => i.createdById !== ws.userId))
        throw new DriveError(
          "Only files you added can go into a private folder.",
        );
      // Make private before moving, so nothing is briefly exposed.
      await db
        .update(driveItems)
        .set({ visibility: "private" })
        .where(
          inArray(
            driveItems.id,
            tree.map((i) => i.id),
          ),
        );
    }
    await db
      .update(driveItems)
      .set({ parentId: target?.id ?? null })
      .where(
        inArray(
          driveItems.id,
          roots.map((i) => i.id),
        ),
      );
  });
}

export async function copyItems(
  ids: string[],
  parentId: string | null,
): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    const { roots, below } = await selection(ws, parse(Ids, ids));
    const target = await destination(ws, parentId && parse(Id, parentId));
    const tree = [
      ...roots,
      ...below.filter((i) => canRead(i, ws.userId) && !i.trashedAt),
    ];
    if (target && tree.some((i) => i.id === target.id))
      throw new DriveError("A folder can't be copied inside itself.");
    // Copies would land in or leak out of the Locked folder unnoticed.
    if (roots.some((i) => i.lockedAt) || target?.lockedAt)
      throw new DriveError("Copies can't go in or out of your Locked folder.");
    const copies = new Map(tree.map((i) => [i.id, randomUUID()]));
    const rootIds = new Set(roots.map((i) => i.id));
    const rows = tree.map((i) => ({
      id: copies.get(i.id)!,
      organizationId: ws.id,
      parentId: rootIds.has(i.id)
        ? (target?.id ?? null)
        : copies.get(i.parentId!)!,
      kind: i.kind,
      name: i.name,
      size: i.size,
      mimeType: i.mimeType,
      color: i.color,
      storageKey: i.storageKey && `${ws.id}/${randomUUID()}`,
      visibility: visibilityIn(target, i.visibility),
      createdById: ws.userId,
    }));
    const files = rows.filter((r) => r.storageKey);
    if (files.length) {
      const bucket = await workspaceBucket(ws.id);
      const source = new Map(tree.map((i) => [copies.get(i.id), i]));
      for (const row of files)
        await bucket.copy(source.get(row.id)!.storageKey!, row.storageKey!);
    }
    await db.insert(driveItems).values(rows);
  });
}

// A subtree can only be removed if every item in it is the caller's to edit;
// otherwise someone else's files (maybe private ones) would disappear.
async function removable(ws: Workspace, ids: string[]) {
  const { roots, below } = await selection(ws, parse(Ids, ids));
  const tree = [...roots, ...below];
  if (!tree.every((i) => canEdit(i, ws)))
    throw new DriveError(
      "This includes files someone else added, so only they can remove them.",
    );
  return { roots, tree };
}

export async function trashItems(ids: string[]): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    const { tree } = await removable(ws, ids);
    if (tree.some((i) => i.lockedAt))
      throw new DriveError(
        "Files in your Locked folder skip the trash. Delete them permanently instead.",
      );
    const live = tree.filter((i) => !i.trashedAt).map((i) => i.id);
    if (live.length)
      await db
        .update(driveItems)
        .set({ trashedAt: new Date() })
        .where(inArray(driveItems.id, live));
  });
}

export async function restoreItems(ids: string[]): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    const { roots, tree } = await removable(ws, ids);
    const parentIds = roots.flatMap((i) => (i.parentId ? [i.parentId] : []));
    const parents = parentIds.length
      ? await db
          .select({ id: driveItems.id, trashedAt: driveItems.trashedAt })
          .from(driveItems)
          .where(inArray(driveItems.id, parentIds))
      : [];
    const trashedParent = new Set(
      parents.filter((p) => p.trashedAt).map((p) => p.id),
    );
    await db
      .update(driveItems)
      .set({ trashedAt: null })
      .where(
        inArray(
          driveItems.id,
          tree.map((i) => i.id),
        ),
      );
    const orphans = roots
      .filter((i) => i.parentId && trashedParent.has(i.parentId))
      .map((i) => i.id);
    // Restored items whose folder is still in the trash go back to the top level.
    if (orphans.length)
      await db
        .update(driveItems)
        .set({ parentId: null })
        .where(inArray(driveItems.id, orphans));
  });
}

export async function deleteItems(ids: string[]): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    const { roots, tree } = await removable(ws, ids);
    // Locked-folder items never go to the trash (it would reveal them).
    if (!roots.every((i) => i.trashedAt || i.lockedAt))
      throw new DriveError("Move items to the trash before deleting them.");
    const keys = tree.flatMap((i) => (i.storageKey ? [i.storageKey] : []));
    if (keys.length) await (await workspaceBucket(ws.id)).remove(keys);
    // Children go with their parent (ON DELETE CASCADE).
    await db.delete(driveItems).where(
      inArray(
        driveItems.id,
        roots.map((i) => i.id),
      ),
    );
  });
}

export async function starItems(
  ids: string[],
  starred: boolean,
): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    const items = await load(ws, parse(Ids, ids));
    if (items.some((i) => i.lockedAt))
      throw new DriveError("Files in your Locked folder can't be starred.");
    if (starred)
      await db
        .insert(driveStars)
        .values(items.map((i) => ({ userId: ws.userId, itemId: i.id })))
        .onConflictDoNothing();
    else
      await db.delete(driveStars).where(
        and(
          eq(driveStars.userId, ws.userId),
          inArray(
            driveStars.itemId,
            items.map((i) => i.id),
          ),
        ),
      );
  });
}

export async function setVisibility(
  id: string,
  visibility: DriveItemVisibility,
): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    const [item] = await load(ws, [parse(Id, id)]);
    const value = parse(z.enum(["shared", "private"]), visibility);
    if (item.lockedAt)
      throw new DriveError("Files in your Locked folder can't be shared.");
    if (item.createdById !== ws.userId)
      throw new DriveError(
        "Only the person who added this can change who sees it.",
      );
    const tree = [item, ...(await descendants(ws, [item.id]))];
    if (value === "private") {
      if (tree.some((i) => i.createdById !== ws.userId))
        throw new DriveError(
          "Someone else added files to this folder. Move them out before making it private.",
        );
    } else {
      for (let parentId = item.parentId; parentId;) {
        const [parent] = await db
          .select({
            parentId: driveItems.parentId,
            visibility: driveItems.visibility,
          })
          .from(driveItems)
          .where(eq(driveItems.id, parentId));
        if (parent.visibility === "private")
          throw new DriveError(
            "It's inside a private folder. Move it out to share it.",
          );
        parentId = parent.parentId;
      }
    }
    await db
      .update(driveItems)
      .set({ visibility: value })
      .where(
        inArray(
          driveItems.id,
          tree.map((i) => i.id),
        ),
      );
  });
}

const MAX_UPLOAD = 5 * 1024 ** 3;

export async function prepareUpload(input: {
  parentId: string | null;
  type: string;
  locked?: boolean;
}): Promise<ActionResult<{ key: string; url: string }>> {
  return run(async () => {
    const ws = await requireWorkspace();
    const data = parse(
      z.object({
        parentId: Id.nullable(),
        type: z.string().max(255),
        locked: z.boolean().default(false),
      }),
      input,
    );
    await placement(ws, data.parentId, data.locked);
    const bucket = await workspaceBucket(ws.id);
    const key = `${ws.id}/${randomUUID()}`;
    return {
      key,
      url: await bucket.uploadUrl(key, data.type || "application/octet-stream"),
    };
  });
}

export async function completeUpload(input: {
  key: string;
  name: string;
  type: string;
  parentId: string | null;
  private: boolean;
  locked?: boolean;
}): Promise<ActionResult<string>> {
  return run(async () => {
    const ws = await requireWorkspace();
    const data = parse(
      z.object({
        key: z.string(),
        name: Name,
        type: z.string().max(255),
        parentId: Id.nullable(),
        private: z.boolean(),
        locked: z.boolean().default(false),
      }),
      input,
    );
    const [space, object] = data.key.split("/");
    if (space !== ws.id || !Id.safeParse(object).success)
      throw new DriveError("Invalid upload.");
    const place = await placement(ws, data.parentId, data.locked);
    const bucket = await workspaceBucket(ws.id);
    const head = await bucket.head(data.key).catch(() => null);
    if (!head)
      throw new DriveError("The upload didn't reach storage. Try again.");
    if ((head.ContentLength ?? 0) > MAX_UPLOAD)
      throw new DriveError("Files can be up to 5 GB.");
    // The type comes from the bytes, not the name. (A range past the end of
    // an empty object is an error, so those skip the read.)
    const start = head.ContentLength
      ? await bucket.peekBytes(data.key, HEAD_BYTES).catch(() => null)
      : new Uint8Array();
    if (!start)
      throw new DriveError("The upload didn't reach storage. Try again.");
    const detected = detectFile(start);
    const [row] = await db
      .insert(driveItems)
      .values({
        organizationId: ws.id,
        parentId: place.parent?.id ?? null,
        kind: detected.kind as DriveItemKind,
        name: data.name,
        size: head.ContentLength ?? 0,
        mimeType: detected.mime,
        storageKey: data.key,
        visibility: place.visibility(data.private ? "private" : "shared"),
        lockedAt: place.lockedAt,
        createdById: ws.userId,
      })
      .returning({ id: driveItems.id });
    return row.id;
  });
}

export async function getFileUrl(
  id: string,
  inline = false,
): Promise<ActionResult<string>> {
  return run(async () => {
    const ws = await requireWorkspace();
    const [item] = await load(ws, [parse(Id, id)]);
    if (!item.storageKey) throw new DriveError("Folders can't be downloaded.");
    return (await workspaceBucket(ws.id)).downloadUrl(
      item.storageKey,
      item.name,
      inline,
      // Players keep requesting ranges while you watch and seek.
      inline && item.kind === "video" ? 6 * 60 * 60 : undefined,
    );
  });
}

// The start of a text file, for its grid thumbnail. Read on the server so
// the bucket needs no CORS rules.
export async function getFileSnippet(id: string): Promise<ActionResult<string>> {
  return run(async () => {
    const ws = await requireWorkspace();
    const [item] = await load(ws, [parse(Id, id)]);
    if (
      !item.storageKey ||
      (item.kind !== "code" && item.kind !== "spreadsheet")
    )
      throw new DriveError("This file has no text preview.");
    const text = await (
      await workspaceBucket(ws.id)
    ).peek(item.storageKey, 1500);
    return text.includes("\u0000") ? "" : text;
  });
}

// Hides items in your Locked folder, which is flat: selected items are taken
// out of their folders, and everything goes private and unstarred.
export async function lockItems(ids: string[]): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    if (!(await getSpaceLock(ws.userId, ws.id)))
      throw new DriveError("Set up your Locked folder first.");
    const { roots, below } = await selection(ws, parse(Ids, ids));
    const tree = [...roots, ...below];
    if (tree.some((i) => i.createdById !== ws.userId))
      throw new DriveError(
        "Only files you added can go in your Locked folder.",
      );
    if (roots.some((i) => i.trashedAt))
      throw new DriveError("Restore it from the trash first.");
    const treeIds = tree.map((i) => i.id);
    // Hidden before detaching, so nothing is briefly exposed.
    await db
      .update(driveItems)
      .set({ lockedAt: new Date(), visibility: "private" })
      .where(inArray(driveItems.id, treeIds));
    await db
      .update(driveItems)
      .set({ parentId: null })
      .where(
        inArray(
          driveItems.id,
          roots.map((i) => i.id),
        ),
      );
    await db.delete(driveStars).where(inArray(driveStars.itemId, treeIds));
  });
}

// Back to the top of My Drive, still private until you share them again.
export async function unlockItems(ids: string[]): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    const { roots, below } = await selection(ws, parse(Ids, ids));
    if (!roots.every((i) => i.lockedAt))
      throw new DriveError("That isn't in your Locked folder.");
    // Detach first: an item left under a still-locked folder would vanish.
    await db
      .update(driveItems)
      .set({ parentId: null })
      .where(
        inArray(
          driveItems.id,
          roots.map((i) => i.id),
        ),
      );
    await db
      .update(driveItems)
      .set({ lockedAt: null })
      .where(
        inArray(
          driveItems.id,
          [...roots, ...below].map((i) => i.id),
        ),
      );
  });
}
