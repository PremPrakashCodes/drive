import "server-only";

import type { DriveItem } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { cache } from "react";

import { db } from "@/db";
import { members, organizations } from "@/db/schema";
import { auth } from "@/lib/auth";
import { Id } from "@/lib/drive/action";
import type { ActionErrorCode, Workspace } from "@/types";

// Thrown for expected failures; the message is safe to show to the user.
// `code` marks the few failures the interface has to react to rather than
// only report, so the client never has to recognise them by their wording.
export class DriveError extends Error {
  readonly code?: ActionErrorCode;
  constructor(message: string, code?: ActionErrorCode) {
    super(message);
    this.code = code;
  }
}

// Which personal workspace (own drive or a family drive you joined) is open.
export const WORKSPACE_COOKIE = "drive-space";

// Only callable from Server Actions (it sets a cookie).
export async function setActiveWorkspace(id: string) {
  (await cookies()).set(WORKSPACE_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

// Back to your own drive; with `id`, only if that workspace is the open one.
export async function clearActiveWorkspace(id?: string) {
  const jar = await cookies();
  if (id === undefined || jar.get(WORKSPACE_COOKIE)?.value === id) jar.delete(WORKSPACE_COOKIE);
}

export const requireSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new DriveError("Your session expired. Sign in again.", "session-expired");
  return session;
});

export const requireUser = async () => (await requireSession()).user;

// Every user owns exactly one personal workspace, created on first use.
// Idempotent: the slug is unique and (user, organization) membership too.
export async function ensurePersonalWorkspace(user: { id: string; name: string }) {
  const slug = `personal-${user.id}`;
  const [existing] = await db
    .select({ id: organizations.id, member: members.id })
    .from(organizations)
    .leftJoin(
      members,
      and(eq(members.organizationId, organizations.id), eq(members.userId, user.id))
    )
    .where(eq(organizations.slug, slug));
  if (existing?.member) return existing.id;
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

// The active workspace for this request, always membership-checked.
export const requireWorkspace = cache(async (): Promise<Workspace> => {
  const user = await requireUser();
  const ownId = await ensurePersonalWorkspace(user);
  const requested = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  const ids = requested && Id.safeParse(requested).success ? [requested, ownId] : [ownId];
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      role: members.role,
      kind: organizations.kind,
    })
    .from(members)
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
    .where(and(eq(members.userId, user.id), inArray(members.organizationId, ids)));
  // The requested workspace if you're a member of it, otherwise your own.
  const row = rows.find((r) => r.id === requested) ?? rows.find((r) => r.id === ownId)!;
  return {
    id: row.id,
    name: row.name,
    role: row.role === "owner" ? "owner" : "member",
    userId: user.id,
    own: row.id === ownId,
    kind: row.kind === "organization" ? "organization" : "personal",
  };
});

// `action` finishes the sentence "Only the drive owner can …".
export function requireOwner(ws: Workspace, action: string) {
  if (ws.role !== "owner") throw new DriveError(`Only the drive owner can ${action}.`);
}

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
