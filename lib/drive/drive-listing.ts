"use server";

import type { DriveItemKind } from "@/db/schema";
import type { ActionResult, DriveListing } from "@/types";
import { and, asc, eq, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import {
  driveItems,
  driveStars,
  members,
  organizations,
  storageConnections,
  storageProviders,
  users,
} from "@/db/schema";
import { run } from "@/lib/drive/action";
import { activeUnlock, getSpaceLock } from "@/lib/drive/unlock";
import { canEdit, requireWorkspace } from "@/lib/drive/workspace";

export async function getDrive(): Promise<ActionResult<DriveListing>> {
  return run(async () => {
    const ws = await requireWorkspace();
    // Only the listing waits on the Locked folder check.
    const unlock = getSpaceLock(ws.userId, ws.id).then(async (lock) => ({
      lock,
      unlockedUntil: lock && (await activeUnlock(lock)),
    }));
    const [{ lock, unlockedUntil }, rows, spaces, [storage]] = await Promise.all([
      unlock,
      unlock.then(({ unlockedUntil }) =>
        db
          .select({
            item: driveItems,
            createdByName: users.name,
            starred: driveStars.itemId,
          })
          .from(driveItems)
          .innerJoin(users, eq(users.id, driveItems.createdById))
          .leftJoin(
            driveStars,
            and(eq(driveStars.itemId, driveItems.id), eq(driveStars.userId, ws.userId))
          )
          .where(
            and(
              eq(driveItems.organizationId, ws.id),
              or(eq(driveItems.visibility, "shared"), eq(driveItems.createdById, ws.userId)),
              // Locked-folder items (always yours) only while it's unlocked.
              unlockedUntil ? undefined : isNull(driveItems.lockedAt)
            )
          )
      ),
      db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          kind: organizations.kind,
        })
        .from(members)
        .innerJoin(organizations, eq(organizations.id, members.organizationId))
        .where(eq(members.userId, ws.userId))
        .orderBy(asc(organizations.name)),
      db
        .select({
          provider: storageProviders.name,
          config: storageConnections.config,
        })
        .from(storageConnections)
        .innerJoin(storageProviders, eq(storageProviders.id, storageConnections.providerId))
        .where(eq(storageConnections.organizationId, ws.id))
        .limit(1),
    ]);
    return {
      workspace: {
        id: ws.id,
        name: ws.name,
        role: ws.role,
        own: ws.own,
        userId: ws.userId,
        kind: ws.kind,
      },
      lockedFolder: {
        hasPin: lock !== null,
        expiresIn: unlockedUntil ? unlockedUntil - Date.now() : null,
      },
      spaces: spaces
        .map((s) => ({
          id: s.id,
          name: s.name,
          own: s.slug === `personal-${ws.userId}`,
          kind: s.kind === "organization" ? ("organization" as const) : ("personal" as const),
        }))
        .sort(
          (a, b) =>
            Number(b.own) - Number(a.own) ||
            Number(a.kind === "organization") - Number(b.kind === "organization")
        ),
      items: rows.map(({ item, createdByName, starred }) => ({
        id: item.id,
        name: item.name,
        kind: item.kind,
        size: item.size,
        mimeType: item.mimeType,
        parentId: item.parentId,
        visibility: item.visibility,
        color: item.color,
        createdById: item.createdById,
        createdByName,
        starred: starred !== null,
        canEdit: canEdit(item, ws),
        locked: item.lockedAt !== null,
        trashedAt: item.trashedAt?.toISOString() ?? null,
        updatedAt: item.updatedAt.toISOString(),
      })),
      storage: storage
        ? {
            connected: true,
            provider: storage.provider,
            bucket: storage.config.bucket,
            region: storage.config.region ?? null,
            endpoint: storage.config.endpoint ?? null,
          }
        : { connected: false },
      storageStats: (() => {
        // Everything not in the trash; folders carry no bytes.
        const live = rows.filter(({ item }) => !item.trashedAt && item.kind !== "folder");
        const usedBytes = live.reduce((sum, { item }) => sum + item.size, 0);
        const byKind = Object.values(
          live.reduce<Record<string, { kind: DriveItemKind; size: number; count: number }>>(
            (acc, { item }) => {
              const bucket = acc[item.kind] ?? { kind: item.kind, size: 0, count: 0 };
              bucket.size += item.size;
              bucket.count += 1;
              acc[item.kind] = bucket;
              return acc;
            },
            {}
          )
        ).sort((a, b) => b.size - a.size);
        return { usedBytes, fileCount: live.length, byKind };
      })(),
    };
  });
}
