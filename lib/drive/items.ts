"use server";

import type { DriveItem, DriveItemVisibility, NewDriveItem } from "@/db/schema";
import type { ActionResult, Workspace } from "@/types";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { db } from "@/db";
import { driveItems, driveStars, members, organizations } from "@/db/schema";
import { atomically, chunks, Id, MAX_TREE_DEPTH, parse, run } from "@/lib/drive/action";
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
import { requireHeadroom } from "@/lib/drive/quota";
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

// The folders already sitting under `parentIds` — one level of the tree at a
// time, so every id here is either the top of the drop or a folder that was
// already in the drive. Trashed ones don't count: landing an upload in one
// would put it somewhere nothing lists.
async function foldersUnder(ws: Workspace, parentIds: (string | null)[]) {
  const scopes =
    parentIds[0] === null
      ? [isNull(driveItems.parentId)]
      : chunks(parentIds as string[]).map((part) => inArray(driveItems.parentId, part));
  const levels = await Promise.all(
    scopes.map((scope) =>
      db
        .select({
          id: driveItems.id,
          parentId: driveItems.parentId,
          name: driveItems.name,
          visibility: driveItems.visibility,
          createdById: driveItems.createdById,
          lockedAt: driveItems.lockedAt,
          createdAt: driveItems.createdAt,
        })
        .from(driveItems)
        .where(
          and(
            eq(driveItems.organizationId, ws.id),
            eq(driveItems.kind, "folder"),
            isNull(driveItems.trashedAt),
            scope
          )
        )
    )
  );
  return levels.flat();
}

// A folder and a name identify a place in the tree; nulls and names both go
// in, so the separator is one no name may contain.
const at = (parentId: string | null, name: string) => `${parentId}\u0000${name}`;

// Recreates an uploaded folder's tree under `parentId` in one request.
// `folders` are paths of names (outermost first) and must list every
// ancestor before its descendants; returns the ids in the same order —
// the folder already there wherever a path names one, so dropping the same
// folder twice fills that tree in rather than building a second one beside it.
export async function createFolderTree(input: {
  parentId: string | null;
  folders: string[][];
  locked?: boolean;
}): Promise<ActionResult<string[]>> {
  return run(async () => {
    const ws = await requireWorkspace();
    const data = parse(
      z.object({
        parentId: Id.nullable(),
        folders: z.array(z.array(ItemName).min(1).max(64)).min(1).max(1000),
        locked: z.boolean().default(false),
      }),
      input
    );
    const place = await placement(ws, data.parentId, data.locked);
    // New folders sit inside `place` (or each other), so all share its rules.
    const visibility = place.visibility("shared");
    // A path is keyed by what the client sent, not by the names that parsed
    // out of it: two folders whose names differ only in the space around them
    // are two folders, and one's children must not land in the other because
    // the trimmed keys read alike.
    const paths = data.folders.map((names, i) => {
      const sent: string[] = input.folders[i] ?? names;
      return {
        names,
        key: JSON.stringify(sent),
        parentKey: JSON.stringify(sent.slice(0, -1)),
      };
    });
    // A folder is the one a path names only if a new folder here would look
    // just like it: same side of the Locked folder, same visibility, and the
    // caller's to see — never someone else's private folder.
    const reusable = (folder: Pick<DriveItem, "visibility" | "createdById" | "lockedAt">) =>
      folder.visibility === visibility &&
      Boolean(folder.lockedAt) === Boolean(place.lockedAt) &&
      canRead(folder, ws.userId, true);

    const ids = new Map<string, string>();
    // Paths whose folder is already in the drive. Only those can have
    // children to find; the ones this call is about to create have none.
    const present = new Set<string>();
    const rows: NewDriveItem[] = [];
    const deepest = Math.max(...paths.map((p) => p.names.length));
    for (let depth = 1; depth <= deepest; depth++) {
      const here = paths
        .filter((p) => p.names.length === depth)
        .map((p) => {
          const parentId = depth === 1 ? (place.parent?.id ?? null) : ids.get(p.parentKey);
          if (parentId === undefined) throw new DriveError("Folders must follow their parents.");
          return { ...p, parentId, look: depth === 1 || present.has(p.parentKey) };
        });
      const parents = [...new Set(here.filter((p) => p.look).map((p) => p.parentId))];
      const existing = new Map<string, { id: string }>();
      if (parents.length)
        for (const folder of (await foldersUnder(ws, parents)).sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)
        )) {
          // The oldest match wins, so a drop repeated twice lands in the same
          // folder both times even where two of a name exist.
          const spot = at(folder.parentId, folder.name);
          if (reusable(folder) && !existing.has(spot)) existing.set(spot, folder);
        }
      for (const path of here) {
        // The same path twice in one drop is one folder.
        if (ids.has(path.key)) continue;
        const name = path.names[depth - 1];
        const match = path.look ? existing.get(at(path.parentId, name)) : undefined;
        if (match) {
          ids.set(path.key, match.id);
          present.add(path.key);
          continue;
        }
        const id = randomUUID();
        ids.set(path.key, id);
        rows.push({
          id,
          organizationId: ws.id,
          parentId: path.parentId,
          kind: "folder",
          name,
          color: "green",
          visibility,
          lockedAt: place.lockedAt,
          createdById: ws.userId,
        });
      }
    }
    // One statement: Postgres checks the parent references once it's done, so
    // a tree that references itself goes in whole or not at all.
    if (rows.length) await db.insert(driveItems).values(rows);
    return paths.map((p) => ids.get(p.key)!);
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
    if (target?.visibility === "private" && tree.some((i) => i.createdById !== ws.userId))
      throw new DriveError("Only files you added can go into a private folder.");
    const reparent = db
      .update(driveItems)
      .set({ parentId: target?.id ?? null })
      .where(
        inArray(
          driveItems.id,
          roots.map((i) => i.id)
        )
      );
    // Going private and moving happen in one batch, so nothing is briefly
    // exposed and a failed move leaves the items shared where they were. The
    // subtree is chunked into that same batch: a dropped directory can hold
    // more items than one statement may bind parameters for.
    if (target?.visibility === "private")
      await atomically([
        ...chunks(tree.map((i) => i.id)).map((part) =>
          db.update(driveItems).set({ visibility: "private" }).where(inArray(driveItems.id, part))
        ),
        reparent,
      ]);
    else await reparent;
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
    // A copy duplicates every byte it touches, so it is weighed against the
    // drive's ceiling like an upload is — nothing else here would stop someone
    // filling the owner's storage by copying the same folder repeatedly.
    await requireHeadroom(
      ws.id,
      tree.flatMap((i) => (i.storageKey ? [i.size] : []))
    );
    // Resolved before anything is written, so a drive with no storage fails
    // without leaving half a copy behind.
    const bucket = files.length ? await workspaceBucket(ws.id) : null;
    // Rows first: a failed copy leaves rows whose bytes are missing, which the
    // orphan sweeper reports, rather than billable objects no row references.
    await db.insert(driveItems).values(rows);
    if (bucket) {
      const source = new Map(tree.map((i) => [copies.get(i.id), i]));
      // A few at a time: fast, without flooding the bucket with requests.
      for (let i = 0; i < files.length; i += 8)
        await Promise.all(
          files
            .slice(i, i + 8)
            .map((row) => bucket.copy(source.get(row.id)!.storageKey!, row.storageKey!))
        );
    }
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
    const trashedAt = new Date();
    // Chunked into one batch, so a subtree too big for a single statement
    // still reaches the trash whole rather than in visible instalments.
    if (live.length)
      await atomically(
        chunks(live).map((part) =>
          db.update(driveItems).set({ trashedAt }).where(inArray(driveItems.id, part))
        )
      );
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
          .where(and(eq(driveItems.organizationId, ws.id), inArray(driveItems.id, parentIds)))
      : [];
    const trashedParent = new Set(parents.filter((p) => p.trashedAt).map((p) => p.id));
    const untrash = chunks(tree.map((i) => i.id)).map((part) =>
      db.update(driveItems).set({ trashedAt: null }).where(inArray(driveItems.id, part))
    );
    const orphans = roots
      .filter((i) => i.parentId && trashedParent.has(i.parentId))
      .map((i) => i.id);
    // Restored items whose folder is still in the trash go back to the top
    // level, in the same batch: they are never out of the trash while still
    // sitting under a trashed folder, where no screen would show them.
    await atomically(
      orphans.length
        ? [
            ...untrash,
            db.update(driveItems).set({ parentId: null }).where(inArray(driveItems.id, orphans)),
          ]
        : untrash
    );
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
    // Resolved first — a read — so a drive with no storage still can't delete.
    const bucket = keys.length ? await workspaceBucket(ws.id) : null;
    // Children go with their parent (ON DELETE CASCADE).
    await db.delete(driveItems).where(
      inArray(
        driveItems.id,
        roots.map((i) => i.id)
      )
    );
    // Objects last: if this fails the bytes are unreferenced and the orphan
    // sweeper reclaims them. Removing them first would leave a surviving row
    // pointing at nothing — a file the drive lists and can never open.
    if (bucket)
      await bucket
        .remove(keys)
        .catch((error) => console.error(`[drive] orphaned ${keys.length} objects`, error));
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
      // Climb to the top: a private folder anywhere above keeps this private.
      // Bounded the same way the downward walk is, and scoped to this drive —
      // the parent reference alone doesn't say which workspace a row is in, so
      // without the filter someone else's folder could decide the answer.
      for (let parentId: string | null = item.parentId, depth = 0; parentId; depth++) {
        if (depth >= MAX_TREE_DEPTH)
          throw new DriveError("These folders are nested too deeply. Move some of them out first.");
        const [parent] = await db
          .select({
            parentId: driveItems.parentId,
            visibility: driveItems.visibility,
          })
          .from(driveItems)
          .where(and(eq(driveItems.organizationId, ws.id), eq(driveItems.id, parentId)));
        if (!parent)
          throw new DriveError("The folder this is in no longer exists. Refresh and try again.");
        if (parent.visibility === "private")
          throw new DriveError("It's inside a private folder. Move it out to share it.");
        parentId = parent.parentId;
      }
    }
    // Chunked into one batch: the whole subtree changes together, so nothing
    // is left shared inside a folder that has just gone private.
    await atomically(
      chunks(tree.map((i) => i.id)).map((part) =>
        db.update(driveItems).set({ visibility: value }).where(inArray(driveItems.id, part))
      )
    );
  });
}
