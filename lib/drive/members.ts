"use server";

import type { ActionResult, Family } from "@/lib/drive/types";
import type { Workspace } from "@/lib/drive/workspace";
import { and, eq, gt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { z } from "zod";

import { db } from "@/db";
import { driveItems, invitations, members, organizations, spaceLocks, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { Id, parse, run } from "@/lib/drive/action";
import { workspaceBucket } from "@/lib/drive/s3";
import { DriveError, requireWorkspace, WORKSPACE_COOKIE } from "@/lib/drive/workspace";

function requireOwner(ws: Workspace) {
  if (ws.role !== "owner") throw new DriveError("Only the drive owner can manage members.");
}

// Private files belong to the person, not the drive: remove them when that
// person leaves (their Locked folder too), along with its PIN. Their shared
// files stay for everyone else.
export async function purgePrivateFiles(organizationId: string, userId: string) {
  await db
    .delete(spaceLocks)
    .where(and(eq(spaceLocks.organizationId, organizationId), eq(spaceLocks.userId, userId)));
  const owned = and(
    eq(driveItems.organizationId, organizationId),
    eq(driveItems.createdById, userId),
    eq(driveItems.visibility, "private")
  );
  const rows = await db.select({ storageKey: driveItems.storageKey }).from(driveItems).where(owned);
  const keys = rows.flatMap((r) => (r.storageKey ? [r.storageKey] : []));
  if (keys.length) await (await workspaceBucket(organizationId)).remove(keys);
  await db.delete(driveItems).where(owned);
}

export async function getFamily(): Promise<ActionResult<Family>> {
  return run(async () => {
    const ws = await requireWorkspace();
    const [people, pending] = await Promise.all([
      db
        .select({
          id: members.id,
          userId: members.userId,
          role: members.role,
          joinedAt: members.createdAt,
          name: users.name,
          email: users.email,
        })
        .from(members)
        .innerJoin(users, eq(users.id, members.userId))
        .where(eq(members.organizationId, ws.id)),
      ws.role === "owner"
        ? db
            .select({
              id: invitations.id,
              email: invitations.email,
              expiresAt: invitations.expiresAt,
            })
            .from(invitations)
            .where(
              and(
                eq(invitations.organizationId, ws.id),
                eq(invitations.status, "pending"),
                gt(invitations.expiresAt, new Date())
              )
            )
        : [],
    ]);
    return {
      workspace: { id: ws.id, name: ws.name, role: ws.role, own: ws.own },
      members: people
        .map((p) => ({
          id: p.id,
          userId: p.userId,
          name: p.name,
          email: p.email,
          role: p.role === "owner" ? ("owner" as const) : ("member" as const),
          joinedAt: p.joinedAt.toISOString(),
          you: p.userId === ws.userId,
        }))
        .sort(
          (a, b) =>
            Number(b.role === "owner") - Number(a.role === "owner") || a.name.localeCompare(b.name)
        ),
      invitations: pending.map((i) => ({
        id: i.id,
        email: i.email,
        expiresAt: i.expiresAt.toISOString(),
      })),
    };
  });
}

export async function inviteMember(email: string): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    requireOwner(ws);
    await auth.api.createInvitation({
      body: {
        email: parse(z.email("Enter a valid email address."), email.trim()),
        role: "member",
        organizationId: ws.id,
        resend: true,
      },
      headers: await headers(),
    });
  });
}

export async function cancelInvitation(id: string): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    requireOwner(ws);
    const invitationId = parse(Id, id);
    const [invitation] = await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(and(eq(invitations.id, invitationId), eq(invitations.organizationId, ws.id)));
    if (!invitation) throw new DriveError("That invitation no longer exists.");
    await auth.api.cancelInvitation({
      body: { invitationId },
      headers: await headers(),
    });
  });
}

export async function removeMember(memberId: string): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    requireOwner(ws);
    const [member] = await db
      .select({ id: members.id, userId: members.userId, role: members.role })
      .from(members)
      .where(and(eq(members.id, parse(Id, memberId)), eq(members.organizationId, ws.id)));
    if (!member) throw new DriveError("That person isn't in this drive.");
    if (member.role === "owner") throw new DriveError("The owner can't be removed.");
    await auth.api.removeMember({
      body: { memberIdOrEmail: member.id, organizationId: ws.id },
      headers: await headers(),
    });
    await purgePrivateFiles(ws.id, member.userId);
  });
}

export async function acceptInvite(id: string): Promise<ActionResult<{ slug: string | null }>> {
  return run(async () => {
    const invitationId = parse(Id, id);
    const [invitation] = await db
      .select({
        organizationId: invitations.organizationId,
        kind: organizations.kind,
        slug: organizations.slug,
      })
      .from(invitations)
      .innerJoin(organizations, eq(organizations.id, invitations.organizationId))
      .where(eq(invitations.id, invitationId));
    if (!invitation) throw new DriveError("This invitation no longer exists.");
    // Better Auth checks the signed-in email matches and the invite is pending.
    const accepted = await auth.api.acceptInvitation({
      body: { invitationId },
      headers: await headers(),
    });
    // Open the drive they just joined.
    (await cookies()).set(WORKSPACE_COOKIE, invitation.organizationId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    void accepted;
    return { slug: invitation.kind === "organization" ? invitation.slug : null };
  });
}

export async function declineInvite(id: string): Promise<ActionResult> {
  return run(async () => {
    await auth.api.rejectInvitation({
      body: { invitationId: parse(Id, id) },
      headers: await headers(),
    });
  });
}

// The owner names their personal drive; members see it in their switcher.
export async function renameWorkspace(name: string): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    if (ws.kind !== "personal") throw new DriveError("Rename organizations from their settings.");
    if (ws.role !== "owner") throw new DriveError("Only the drive owner can rename it.");
    await db
      .update(organizations)
      .set({
        name: parse(
          z
            .string()
            .trim()
            .min(1, "Give your drive a name.")
            .max(64, "Use no more than 64 characters."),
          name
        ),
      })
      .where(eq(organizations.id, ws.id));
  });
}

export async function leaveWorkspace(): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    if (ws.own || ws.role === "owner") throw new DriveError("You can't leave your own drive.");
    await auth.api.leaveOrganization({
      body: { organizationId: ws.id },
      headers: await headers(),
    });
    await purgePrivateFiles(ws.id, ws.userId);
    (await cookies()).delete(WORKSPACE_COOKIE);
  });
}
