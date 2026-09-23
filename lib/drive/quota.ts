import "server-only";

import { and, eq, isNotNull, sum } from "drizzle-orm";

import { db } from "@/db";
import { driveItems } from "@/db/schema";
import { env } from "@/env";
import { DriveError } from "@/lib/drive/workspace";
import { formatSize } from "@/lib/workspace/data";

// How much one drive may keep. The schema has no quota concept — usage is
// computed for display — so every drive is held to the same configured
// ceiling rather than an allowance nobody can set.
export const STORAGE_QUOTA = env.STORAGE_QUOTA_BYTES;

// The size the client says a file is, before it exists in storage. Untrusted:
// it decides whether the batch is worth issuing URLs for, while the ceiling on
// a single file is checked again against the object itself once it lands.
export function declaredSize(file: unknown) {
  const size = (file as { size?: unknown } | null)?.size;
  return typeof size === "number" && Number.isFinite(size) && size > 0 ? size : 0;
}

// Why this batch doesn't fit, or null if it does.
export function headroomRefusal(used: number, incoming: number, ceiling: number): string | null {
  if (used + incoming <= ceiling) return null;
  const free = Math.max(ceiling - used, 0);
  return `This drive is out of space: ${formatSize(free)} free of ${formatSize(ceiling)}, and these files need ${formatSize(incoming)}.`;
}

// What the drive is holding in its bucket. Trashed files are counted: their
// bytes are still there until the trash is emptied. Folders carry no object
// and no bytes.
export async function workspaceUsage(organizationId: string) {
  const [row] = await db
    .select({ used: sum(driveItems.size) })
    .from(driveItems)
    .where(and(eq(driveItems.organizationId, organizationId), isNotNull(driveItems.storageKey)));
  return Number(row?.used ?? 0);
}

// Refuses a batch the drive has no room for — all of it, not the files that
// happen to come last. Every other check in an upload carries a result per
// file; this one is about the drive, so one answer covers the batch.
export async function requireHeadroom(
  organizationId: string,
  sizes: number[],
  ceiling = STORAGE_QUOTA
) {
  const incoming = sizes.reduce((total, size) => total + size, 0);
  if (!incoming) return;
  const refusal = headroomRefusal(await workspaceUsage(organizationId), incoming, ceiling);
  if (refusal) throw new DriveError(refusal);
}
