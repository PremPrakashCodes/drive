import "server-only";

import type { DriveItem, DriveItemVisibility } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { driveItems } from "@/db/schema";
import { Id, parse } from "@/lib/drive/action";
import { getSpaceLock, lockedFolderOpen } from "@/lib/drive/unlock";
import { canRead, DriveError } from "@/lib/drive/workspace";
import type { Workspace } from "@/types";

export const Ids = z.array(Id).min(1).max(500);
export const Name = z
  .string()
  .trim()
  .min(1, "Enter a name.")
  .max(255, "Names can be up to 255 characters.")
  .refine((v) => !/[\x00-\x1f/\\]/.test(v), "Names can't contain / or \\.");

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

// All descendants of `ids` (readable or not), breadth-first.
export async function descendants(ws: Workspace, ids: string[]) {
  const found: DriveItem[] = [];
  for (let frontier = ids; frontier.length;) {
    const rows = await db
      .select()
      .from(driveItems)
      .where(and(eq(driveItems.organizationId, ws.id), inArray(driveItems.parentId, frontier)));
    found.push(...rows);
    frontier = rows.map((r) => r.id);
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
