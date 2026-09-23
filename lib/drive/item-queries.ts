import "server-only";

import type { DriveItem, DriveItemVisibility } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { driveItems } from "@/db/schema";
import { Id, MAX_TREE_DEPTH, parse } from "@/lib/drive/action";
import { chunks } from "@/lib/drive/trash";
import { getSpaceLock, lockedFolderOpen } from "@/lib/drive/unlock";
import { canRead, DriveError } from "@/lib/drive/workspace";
import type { Workspace } from "@/types";

export const Ids = z.array(Id).min(1).max(500);

// Loads items by id. Items the caller can't read are treated as missing, so
// a private item's existence never leaks.
export async function load(ws: Workspace, ids: string[]) {
  const rows = await db
    .select()
    .from(driveItems)
    .where(and(eq(driveItems.organizationId, ws.id), inArray(driveItems.id, ids)));
  // Your Locked folder's items need it unlocked; anyone else's stay missing.
  const locked = rows.some((r) => r.lockedAt && r.createdById === ws.userId);
  const open = locked && (await lockedFolderOpen(ws.userId, ws.id)) !== null;
  if (locked && !open)
    throw new DriveError("Your Locked folder is locked. Enter your PIN to open it.");
  const visible = rows.filter((r) => canRead(r, ws.userId, open));
  if (visible.length !== new Set(ids).size)
    throw new DriveError("Some of these items no longer exist.");
  return visible;
}

// All descendants of `ids` (readable or not), breadth-first, each one once.
export async function descendants(ws: Workspace, ids: string[]) {
  const found: DriveItem[] = [];
  // Rows already collected. A selection can hold both a folder and something
  // inside it — a flat screen lists them side by side, and select-all takes
  // the lot — and returning that item twice makes a copy fail on its own
  // primary key, after the bytes have already been copied.
  const seen = new Set<string>();
  // Ids whose children have been read, seeded with the selection itself. A
  // parent cycle is walked into once and then left, however the rows got that
  // way: the move that would create one checks before it writes, so two at
  // once can still slip past.
  const asked = new Set(ids);
  for (let frontier = ids, depth = 0; frontier.length; depth++) {
    if (depth >= MAX_TREE_DEPTH)
      throw new DriveError("These folders are nested too deeply. Move some of them out first.");
    const next: string[] = [];
    // A level at a time, chunked: a whole dropped directory lands at once, so
    // one level can hold more items than a statement may bind parameters for.
    for (const part of chunks(frontier)) {
      const rows = await db
        .select()
        .from(driveItems)
        .where(and(eq(driveItems.organizationId, ws.id), inArray(driveItems.parentId, part)));
      for (const item of rows) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          found.push(item);
        }
        if (!asked.has(item.id)) {
          asked.add(item.id);
          next.push(item.id);
        }
      }
    }
    frontier = next;
  }
  return found;
}

// Awaits independent reads together; a failure surfaces as if they ran in order.
export async function inOrder<T extends readonly unknown[]>(
  ...steps: { [K in keyof T]: Promise<T[K]> }
): Promise<T> {
  const results = await Promise.allSettled(steps as readonly Promise<unknown>[]);
  for (const result of results) if (result.status === "rejected") throw result.reason;
  return results.map((r) => (r as PromiseFulfilledResult<unknown>).value) as unknown as T;
}

// Selected items, minus any nested inside another selected folder.
export async function selection(ws: Workspace, ids: string[]) {
  const [items, below] = await inOrder(load(ws, ids), descendants(ws, ids));
  const nested = new Set(below.map((i) => i.id));
  return { roots: items.filter((i) => !nested.has(i.id)), below };
}

export async function destination(ws: Workspace, id: string | null) {
  if (!id) return null;
  const [folder] = await load(ws, [parse(Id, id)]);
  if (folder.kind !== "folder" || folder.trashedAt)
    throw new DriveError("That folder isn't available.");
  return folder; // readable, so a private folder is always the caller's
}

// Items inside a private folder are private too.
export const visibilityIn = (
  parent: DriveItem | null,
  requested: DriveItemVisibility
): DriveItemVisibility => (parent?.visibility === "private" ? "private" : requested);

// Where new folders and uploads go. Inside the Locked folder (its top level,
// or any folder in it) they're locked and private too. Adding at the top level
// needs only a PIN, since it reveals nothing; a locked parent needs an unlock.
export async function placement(ws: Workspace, parentId: string | null, locked: boolean) {
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
