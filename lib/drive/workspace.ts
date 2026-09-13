import "server-only";

import type { DriveItem } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { cache } from "react";

import { db } from "@/db";
import { members, organizations } from "@/db/schema";
import { auth } from "@/lib/auth";

// Thrown for expected failures; the message is safe to show to the user.
export class DriveError extends Error {}

// Which personal workspace (own drive or a family drive you joined) is open.
export const WORKSPACE_COOKIE = "drive-space";

export const requireUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new DriveError("Your session expired. Sign in again.");
  return session.user;
});

// Every user owns exactly one personal workspace, created on first use.
// Idempotent: the slug is unique and (user, organization) membership too.
export async function ensurePersonalWorkspace(user: { id: string; name: string }) {
  const slug = `personal-${user.id}`;
  await db
    .insert(organizations)
    .values({
      name: `${user.name.trim().split(/\s+/)[0] || "My"}'s drive`,
      slug,
      kind: "personal",
    })
    .onConflictDoNothing();
  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug));
  await db
    .insert(members)
    .values({ organizationId: org.id, userId: user.id, role: "owner" })
    .onConflictDoNothing();
  return org.id;
}

export type Workspace = {
  id: string;
  name: string;
  role: "owner" | "member";
  userId: string;
  own: boolean;
};

// The active personal workspace for this request, always membership-checked.
export const requireWorkspace = cache(async (): Promise<Workspace> => {
  const user = await requireUser();
  const ownId = await ensurePersonalWorkspace(user);
  const requested = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  const load = (organizationId: string) =>
    db
      .select({
        id: organizations.id,
        name: organizations.name,
        role: members.role,
      })
      .from(members)
      .innerJoin(organizations, eq(organizations.id, members.organizationId))
      .where(
        and(
          eq(members.userId, user.id),
          eq(members.organizationId, organizationId),
          eq(organizations.kind, "personal")
        )
      );
  const [row] = (
    requested && /^[0-9a-f-]{36}$/i.test(requested) ? await load(requested) : []
  ).concat(await load(ownId));
  return {
    id: row.id,
    name: row.name,
    role: row.role === "owner" ? "owner" : "member",
    userId: user.id,
    own: row.id === ownId,
  };
});

// Locked-folder items are their creator's alone, and only while it's unlocked.
export function canRead(
  item: Pick<DriveItem, "visibility" | "createdById" | "lockedAt">,
  userId: string,
  lockedFolderOpen = false
) {
  if (item.lockedAt) return lockedFolderOpen && item.createdById === userId;
  return item.visibility === "shared" || item.createdById === userId;
}

// Creators edit their own items; the owner can also tidy up shared items.
export function canEdit(item: Pick<DriveItem, "visibility" | "createdById">, workspace: Workspace) {
  return (
    item.createdById === workspace.userId ||
    (workspace.role === "owner" && item.visibility === "shared")
  );
}
