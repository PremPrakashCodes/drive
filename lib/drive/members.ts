"use server";

import type { ActionResult, Family } from "@/types";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import { invitations, members, organizations, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { emailSchema } from "@/lib/auth-form";
import { Id, parse, run } from "@/lib/drive/action";
import {
  cancelWorkspaceInvitation,
  isPendingInvitation,
  purgePrivateFiles,
  removeWorkspaceMember,
} from "@/lib/drive/membership";
import {
  clearActiveWorkspace,
  DriveError,
  requireOwner,
  requireWorkspace,
  setActiveWorkspace,
} from "@/lib/drive/workspace";
import { DriveName } from "@/lib/workspace/names";

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
            .where(and(eq(invitations.organizationId, ws.id), isPendingInvitation()))
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
    requireOwner(ws, "manage members");
    await auth.api.createInvitation({
      body: {
        email: parse(emailSchema, email),
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
    requireOwner(ws, "manage members");
    await cancelWorkspaceInvitation(ws.id, id);
  });
}

export async function removeMember(memberId: string): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    requireOwner(ws, "manage members");
    await removeWorkspaceMember(ws.id, memberId, "That person isn't in this drive.");
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
    await auth.api.acceptInvitation({
      body: { invitationId },
      headers: await headers(),
    });
    // Open the drive they just joined.
    await setActiveWorkspace(invitation.organizationId);
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
    requireOwner(ws, "rename it");
    await db
      .update(organizations)
      .set({
        name: parse(DriveName, name),
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
    await clearActiveWorkspace();
  });
}
