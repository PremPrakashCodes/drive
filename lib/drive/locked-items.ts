"use server";

import type { ActionResult } from "@/types";
import { inArray } from "drizzle-orm";

import { db } from "@/db";
import { driveItems, driveStars } from "@/db/schema";
import { parse, run } from "@/lib/drive/action";
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
    if (roots.some((i) => i.trashedAt)) throw new DriveError("Restore it from the trash first.");
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
          roots.map((i) => i.id)
        )
      );
    await db.delete(driveStars).where(inArray(driveStars.itemId, treeIds));
  });
}

// Back to the top of My Drive, still private until you share them again.
export async function unlockItems(ids: string[]): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    const { roots, below } = await selection(ws, parse(Ids, ids));
    if (!roots.every((i) => i.lockedAt)) throw new DriveError("That isn't in your Locked folder.");
    // Detach first: an item left under a still-locked folder would vanish.
    await db
      .update(driveItems)
      .set({ parentId: null })
      .where(
        inArray(
          driveItems.id,
          roots.map((i) => i.id)
        )
      );
    await db
      .update(driveItems)
      .set({ lockedAt: null })
      .where(
        inArray(
          driveItems.id,
          [...roots, ...below].map((i) => i.id)
        )
      );
  });
}
