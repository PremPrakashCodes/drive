"use server";

import type { ActionResult } from "@/types";
import { inArray } from "drizzle-orm";

import { db } from "@/db";
import { driveItems, driveStars } from "@/db/schema";
import { atomically, chunks, parse, run } from "@/lib/drive/action";
import { Ids, selection } from "@/lib/drive/item-queries";
import { getSpaceLock } from "@/lib/drive/unlock";
import { DriveError, requireWorkspace } from "@/lib/drive/workspace";

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
      throw new DriveError("Only files you added can go in your Locked folder.");
    // Anywhere in the tree, not just the roots: locked and trashed at once is
    // invisible everywhere, since the Locked page shows only what isn't
    // trashed and the Trash page only what isn't locked.
    const trashed = tree.find((i) => i.trashedAt);
    if (trashed) throw new DriveError(`“${trashed.name}” is in the trash. Restore it first.`);
    const treeIds = tree.map((i) => i.id);
    const lockedAt = new Date();
    // One batch: hidden, taken out of their folders and unstarred together, so
    // nothing is briefly exposed and a failure leaves none of it applied. The
    // tree-wide statements are chunked — a dropped directory can hold more
    // items than one statement may bind — and stay in the same batch.
    await atomically([
      ...chunks(treeIds).map((part) =>
        db
          .update(driveItems)
          .set({ lockedAt, visibility: "private" })
          .where(inArray(driveItems.id, part))
      ),
      db
        .update(driveItems)
        .set({ parentId: null })
        .where(
          inArray(
            driveItems.id,
            roots.map((i) => i.id)
          )
        ),
      ...chunks(treeIds).map((part) =>
        db.delete(driveStars).where(inArray(driveStars.itemId, part))
      ),
    ]);
  });
}

// Back to the top of My Drive, still private until you share them again.
export async function unlockItems(ids: string[]): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    const { roots, below } = await selection(ws, parse(Ids, ids));
    if (!roots.every((i) => i.lockedAt)) throw new DriveError("That isn't in your Locked folder.");
    // One batch: an item is never left under a still-locked folder, where it
    // would vanish from every listing.
    await atomically([
      db
        .update(driveItems)
        .set({ parentId: null })
        .where(
          inArray(
            driveItems.id,
            roots.map((i) => i.id)
          )
        ),
      ...chunks([...roots, ...below].map((i) => i.id)).map((part) =>
        db.update(driveItems).set({ lockedAt: null }).where(inArray(driveItems.id, part))
      ),
    ]);
  });
}
