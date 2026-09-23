import "server-only";

import { subDays } from "date-fns";
import { and, eq, inArray, lt } from "drizzle-orm";

import { db } from "@/db";
import { driveItems } from "@/db/schema";
import { MAX_TREE_DEPTH } from "@/lib/drive/action";
import { workspaceBucket } from "@/lib/drive/s3";
import { TRASH_RETENTION_DAYS } from "@/lib/workspace/data";

// Keeps `IN (...)` lists well under Postgres' bind-parameter limit.
const CHUNK = 500;
export const chunks = <T>(list: T[]) =>
  Array.from({ length: Math.ceil(list.length / CHUNK) }, (_, i) =>
    list.slice(i * CHUNK, (i + 1) * CHUNK)
  );

// Permanently deletes everything that has sat in the trash longer than
// TRASH_RETENTION_DAYS, across every workspace. Runs from the daily cron, so
// there's no session: a failing workspace is reported and the rest continue.
export async function purgeExpiredTrash(now = new Date()) {
  const expired = await db
    .select({
      id: driveItems.id,
      organizationId: driveItems.organizationId,
      parentId: driveItems.parentId,
    })
    .from(driveItems)
    .where(lt(driveItems.trashedAt, subDays(now, TRASH_RETENTION_DAYS)));

  const byWorkspace = new Map<string, typeof expired>();
  for (const item of expired)
    byWorkspace.set(item.organizationId, [...(byWorkspace.get(item.organizationId) ?? []), item]);
  let deleted = 0;
  const failed: string[] = [];

  for (const [organizationId, items] of byWorkspace) {
    try {
      const ids = new Set(items.map((i) => i.id));
      // Only the topmost expired items; children go with them (ON DELETE CASCADE).
      const roots = items.filter((i) => !i.parentId || !ids.has(i.parentId)).map((i) => i.id);

      // Walk the whole tree: the cascade also removes rows that weren't expired
      // themselves, and their objects must not be orphaned in the bucket.
      const keys: string[] = [];
      // Seen once each: a parent cycle would otherwise walk forever, and the
      // same object would be queued for removal more than once.
      const seen = new Set<string>();
      let depth = 0;
      for (let frontier = roots, first = true; frontier.length; first = false) {
        if (depth++ >= MAX_TREE_DEPTH)
          throw new Error("expired items are nested deeper than a purge will walk");
        const next: string[] = [];
        for (const part of chunks(frontier)) {
          const rows = await db
            .select({ id: driveItems.id, storageKey: driveItems.storageKey })
            .from(driveItems)
            .where(
              and(
                eq(driveItems.organizationId, organizationId),
                inArray(first ? driveItems.id : driveItems.parentId, part)
              )
            );
          for (const row of rows) {
            if (seen.has(row.id)) continue;
            seen.add(row.id);
            if (row.storageKey) keys.push(row.storageKey);
            next.push(row.id);
          }
        }
        frontier = next;
      }
      const count = seen.size;

      // Resolved before anything is written: a workspace whose storage is gone
      // keeps its rows, so the next run can try again with both still in hand.
      const bucket = keys.length ? await workspaceBucket(organizationId) : null;
      for (const part of chunks(roots))
        await db.delete(driveItems).where(inArray(driveItems.id, part));
      deleted += count;
      // Objects last: a failure here leaves bytes no row references, which the
      // orphan sweeper reclaims. The reverse would leave rows pointing at
      // objects that are already gone.
      if (bucket) await bucket.remove(keys);
    } catch (error) {
      console.error(`Trash cleanup failed for workspace ${organizationId}`, error);
      failed.push(organizationId);
    }
  }

  return { deleted, failed };
}
