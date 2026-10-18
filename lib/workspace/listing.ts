import type { DriveFile, DriveListing } from "@/types";

import { activeStorage } from "./providers";

// The organization a route names, by slug (or id).
export function findOrganization<T extends { id: string; slug: string }>(
  orgs: T[],
  slugOrId: string | null | undefined
) {
  return slugOrId ? orgs.find((o) => o.slug === slugOrId || o.id === slugOrId) : undefined;
}

export function toDriveFiles(listing: DriveListing): DriveFile[] {
  const provider = activeStorage(listing.storage)?.provider.name ?? "No storage connected";
  return listing.items.map((i) => ({
    id: i.id,
    name: i.name,
    kind: i.kind,
    size: i.size,
    modified: i.updatedAt,
    owner: i.createdByName,
    ownerId: i.createdById,
    parent: i.parentId,
    starred: i.starred,
    // "Shared with me": what other people added for everyone.
    shared: i.visibility === "shared" && i.createdById !== listing.workspace.userId,
    trashed: i.trashedAt !== null,
    deletedAt: i.trashedAt ?? undefined,
    provider,
    color: i.color ?? undefined,
    mime: i.mimeType ?? undefined,
    visibility: i.visibility,
    canEdit: i.canEdit,
    locked: i.locked,
  }));
}
