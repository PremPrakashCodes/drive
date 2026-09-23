import "server-only";

import type { OrphanSweep, StoredObject } from "@/types";
import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { driveItems, organizations } from "@/db/schema";
import { workspaceBucket } from "@/lib/drive/s3";
import { DriveError } from "@/lib/drive/workspace";

// How long an unreferenced object is left alone. The window it has to clear is
// object-landed to row-recorded — seconds, while an upload finishes — so a day
// is conservative by a wide margin, and it still bounds how long the bytes of
// a permanently deleted file survive.
export const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

// The listed objects that no row claims and that are old enough to be sure of.
// An object with no reported age is left alone: the sweep only removes bytes
// it can prove are past the window.
export function reclaimable(
  objects: StoredObject[],
  referenced: Set<string>,
  now: Date,
  graceMs = ORPHAN_GRACE_MS
) {
  const cutoff = now.getTime() - graceMs;
  return objects
    .filter(
      (o) => !referenced.has(o.key) && o.lastModified !== null && o.lastModified.getTime() < cutoff
    )
    .map((o) => o.key);
}

// Rows pointing at bytes the bucket doesn't have. Reported, never deleted: a
// missing object is not evidence the row is wrong, and the row is the only
// record that the file was ever there.
export function unbacked(rows: { id: string; storageKey: string }[], present: Set<string>) {
  return rows.filter((r) => !present.has(r.storageKey)).map((r) => r.id);
}

// Sweeps every workspace's bucket: objects under its prefix that no row
// references are removed once they're past the grace period, and rows whose
// object is absent are reported back for the cron route to log. Runs from the
// daily cron, so there's no session: a failing workspace is recorded and the
// rest continue.
export async function reclaimOrphans(now = new Date()): Promise<OrphanSweep> {
  const workspaces = await db.select({ id: organizations.id }).from(organizations);
  const sweep: OrphanSweep = { reclaimed: 0, unbacked: [], skipped: 0, failed: [] };

  for (const { id } of workspaces) {
    try {
      // Nothing to sweep without a bucket, and a workspace may never have
      // connected one.
      const bucket = await workspaceBucket(id).catch((error) => {
        if (error instanceof DriveError) return null;
        throw error;
      });
      if (!bucket) {
        sweep.skipped += 1;
        continue;
      }
      // Keys are `<workspace id>/<object id>`, so the prefix is the whole
      // workspace and nothing else in a shared bucket.
      const objects = await bucket.list(`${id}/`);
      const rows = (await db
        .select({ id: driveItems.id, storageKey: driveItems.storageKey })
        .from(driveItems)
        .where(and(eq(driveItems.organizationId, id), isNotNull(driveItems.storageKey)))) as {
        id: string;
        storageKey: string;
      }[];

      const keys = reclaimable(objects, new Set(rows.map((r) => r.storageKey)), now);
      if (keys.length) await bucket.remove(keys);
      sweep.reclaimed += keys.length;
      sweep.unbacked.push(...unbacked(rows, new Set(objects.map((o) => o.key))));
    } catch (error) {
      console.error(`Orphan sweep failed for workspace ${id}`, error);
      sweep.failed.push(id);
    }
  }

  return sweep;
}
