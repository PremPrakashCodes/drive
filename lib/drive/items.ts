"use server";

import type { DriveItemVisibility } from "@/db/schema";
import type { ActionResult, Workspace } from "@/types";
import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { db } from "@/db";
import { driveItems, driveStars, members, organizations } from "@/db/schema";
import { Id, parse, run } from "@/lib/drive/action";
import {
  descendants,
  destination,
  Ids,
  inOrder,
  load,
  placement,
  selection,
  visibilityIn,
} from "@/lib/drive/item-queries";
import { workspaceBucket } from "@/lib/drive/s3";
import {
  canEdit,
  canRead,
  DriveError,
  requireUser,
  requireWorkspace,
  setActiveWorkspace,
} from "@/lib/drive/workspace";
import { ItemName } from "@/lib/workspace/names";

export async function switchSpace(id: string): Promise<ActionResult> {
  return run(async () => {
    const user = await requireUser();
    const spaceId = parse(Id, id);
    const [membership] = await db
      .select({ id: members.id })
      .from(members)
      .innerJoin(organizations, eq(organizations.id, members.organizationId))
      .where(and(eq(members.userId, user.id), eq(members.organizationId, spaceId)));
    if (!membership) throw new DriveError("You're not a member of that drive.");
    await setActiveWorkspace(spaceId);
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
        name: ItemName,
        parentId: Id.nullable(),
        private: z.boolean(),
        locked: z.boolean().default(false),
      }),
      input
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

export async function renameItem(id: string, name: string): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    const [item] = await load(ws, [parse(Id, id)]);
    if (!canEdit(item, ws)) throw new DriveError("Only the person who added this can rename it.");
    await db
      .update(driveItems)
      .set({ name: parse(ItemName, name) })
      .where(eq(driveItems.id, item.id));
  });
}

export async function moveItems(ids: string[], parentId: string | null): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    const [{ roots, below }, target] = await inOrder(
      selection(ws, parse(Ids, ids)),
      destination(ws, parentId)
    );
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
          : "Use “Move to Locked folder” to hide files."
      );
    if (!roots.every((i) => canEdit(i, ws)))
      throw new DriveError("You can only move items you added.");
    if (target?.visibility === "private") {
      if (tree.some((i) => i.createdById !== ws.userId))
        throw new DriveError("Only files you added can go into a private folder.");
      // Make private before moving, so nothing is briefly exposed.
      await db
        .update(driveItems)
        .set({ visibility: "private" })
        .where(
          inArray(
            driveItems.id,
            tree.map((i) => i.id)
          )
        );
    }
    await db
      .update(driveItems)
      .set({ parentId: target?.id ?? null })
      .where(
        inArray(
          driveItems.id,
          roots.map((i) => i.id)
        )
      );
  });
}

export async function copyItems(ids: string[], parentId: string | null): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    const [{ roots, below }, target] = await inOrder(
      selection(ws, parse(Ids, ids)),
      destination(ws, parentId)
    );
    const tree = [...roots, ...below.filter((i) => canRead(i, ws.userId) && !i.trashedAt)];
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
      parentId: rootIds.has(i.id) ? (target?.id ?? null) : copies.get(i.parentId!)!,
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
      // A few at a time: fast, without flooding the bucket with requests.
      for (let i = 0; i < files.length; i += 8)
        await Promise.all(
          files
            .slice(i, i + 8)
            .map((row) => bucket.copy(source.get(row.id)!.storageKey!, row.storageKey!))
        );
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
    throw new DriveError("This includes files someone else added, so only they can remove them.");
  return { roots, tree };
}

export async function trashItems(ids: string[]): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    const { tree } = await removable(ws, ids);
    if (tree.some((i) => i.lockedAt))
      throw new DriveError(
        "Files in your Locked folder skip the trash. Delete them permanently instead."
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
    const trashedParent = new Set(parents.filter((p) => p.trashedAt).map((p) => p.id));
    await db
      .update(driveItems)
      .set({ trashedAt: null })
      .where(
        inArray(
          driveItems.id,
          tree.map((i) => i.id)
        )
      );
    const orphans = roots
      .filter((i) => i.parentId && trashedParent.has(i.parentId))
      .map((i) => i.id);
    // Restored items whose folder is still in the trash go back to the top level.
    if (orphans.length)
      await db.update(driveItems).set({ parentId: null }).where(inArray(driveItems.id, orphans));
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
        roots.map((i) => i.id)
      )
    );
  });
}

export async function starItems(ids: string[], starred: boolean): Promise<ActionResult> {
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
            items.map((i) => i.id)
          )
        )
      );
  });
}

export async function setVisibility(
  id: string,
  visibility: DriveItemVisibility
): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    const [item] = await load(ws, [parse(Id, id)]);
    const value = parse(z.enum(["shared", "private"]), visibility);
    if (item.lockedAt) throw new DriveError("Files in your Locked folder can't be shared.");
    if (item.createdById !== ws.userId)
      throw new DriveError("Only the person who added this can change who sees it.");
    const tree = [item, ...(await descendants(ws, [item.id]))];
    if (value === "private") {
      if (tree.some((i) => i.createdById !== ws.userId))
        throw new DriveError(
          "Someone else added files to this folder. Move them out before making it private."
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
          throw new DriveError("It's inside a private folder. Move it out to share it.");
        parentId = parent.parentId;
      }
    }
    await db
      .update(driveItems)
      .set({ visibility: value })
      .where(
        inArray(
          driveItems.id,
          tree.map((i) => i.id)
        )
      );
  });
}
