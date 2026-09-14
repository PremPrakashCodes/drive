"use server";

import type { ActionResult, DriveOrganization, MyInvitation, OrgOverview } from "@/types";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { db } from "@/db";
import {
  driveItems,
  invitations,
  members,
  organizations,
  storageConnections,
  teamMembers,
  teams,
  users,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { splitEmails } from "@/lib/auth-form";
import { Id, parse, run } from "@/lib/drive/action";
import {
  cancelWorkspaceInvitation,
  isPendingInvitation,
  removeWorkspaceMember,
} from "@/lib/drive/membership";
import { requireManage, requireOrg, Role, roleOf } from "@/lib/drive/org-access";
import { workspaceBucket } from "@/lib/drive/s3";
import { clearActiveWorkspace, DriveError, requireSession } from "@/lib/drive/workspace";
import { OrgName, TeamName } from "@/lib/workspace/names";
import { OrgSlug, slugify } from "@/lib/workspace/org-slug";

export async function getOrganizations(): Promise<ActionResult<DriveOrganization[]>> {
  return run(async () => {
    const session = await requireSession();
    const rows = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        role: members.role,
        joinedAt: members.createdAt,
      })
      .from(members)
      .innerJoin(organizations, eq(organizations.id, members.organizationId))
      .where(and(eq(members.userId, session.user.id), eq(organizations.kind, "organization")))
      .orderBy(asc(organizations.createdAt));
    const counts = rows.length
      ? await db
          .select({ organizationId: members.organizationId, members: count() })
          .from(members)
          .where(
            inArray(
              members.organizationId,
              rows.map((r) => r.id)
            )
          )
          .groupBy(members.organizationId)
      : [];
    const memberCount = new Map(counts.map((c) => [c.organizationId, c.members]));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      role: roleOf(r.role),
      members: memberCount.get(r.id) ?? 0,
      createdAt: r.joinedAt.toISOString(),
    }));
  });
}

export async function getOrgOverview(slug: string): Promise<ActionResult<OrgOverview>> {
  return run(async () => {
    const ctx = await requireOrg(slug);
    const [teamRows, memberRows, invitationRows, teamMemberRows] = await Promise.all([
      db
        .select({
          id: teams.id,
          name: teams.name,
          description: teams.description,
          color: teams.color,
          memberCount: teams.memberCount,
          createdAt: teams.createdAt,
        })
        .from(teams)
        .where(eq(teams.organizationId, ctx.id))
        .orderBy(asc(teams.name)),
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
        .where(eq(members.organizationId, ctx.id))
        .orderBy(asc(members.createdAt)),
      ctx.role !== "member"
        ? db
            .select({
              id: invitations.id,
              email: invitations.email,
              role: invitations.role,
              teamId: invitations.teamId,
              expiresAt: invitations.expiresAt,
            })
            .from(invitations)
            .where(and(eq(invitations.organizationId, ctx.id), isPendingInvitation()))
            .orderBy(asc(invitations.expiresAt))
        : [],
      db
        .select({ teamId: teamMembers.teamId, userId: teamMembers.userId })
        .from(teamMembers)
        .innerJoin(teams, eq(teams.id, teamMembers.teamId))
        .where(eq(teams.organizationId, ctx.id)),
    ]);
    const teamSize = new Map<string, number>();
    const teamsOf = new Map<string, string[]>();
    for (const { teamId, userId } of teamMemberRows) {
      teamSize.set(teamId, (teamSize.get(teamId) ?? 0) + 1);
      teamsOf.set(userId, [...(teamsOf.get(userId) ?? []), teamId]);
    }
    return {
      organization: {
        id: ctx.id,
        name: ctx.name,
        slug,
        role: ctx.role,
        members: memberRows.length,
        createdAt: memberRows[0]?.joinedAt.toISOString() ?? "",
      },
      teams: teamRows.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        color: t.color,
        memberCount: teamSize.get(t.id) ?? 0,
        createdAt: t.createdAt.toISOString(),
      })),
      members: memberRows.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.name,
        email: m.email,
        role: roleOf(m.role),
        joinedAt: m.joinedAt.toISOString(),
        teams: teamsOf.get(m.userId) ?? [],
        banned: false,
      })),
      invitations: invitationRows.map((i) => ({
        id: i.id,
        email: i.email,
        role: roleOf(i.role),
        teamId: i.teamId,
        expiresAt: i.expiresAt.toISOString(),
      })),
    };
  });
}

async function slugTaken(slug: string) {
  const [existing] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug));
  return Boolean(existing);
}

// Whether an organization URL is valid and free, for the create wizard.
export async function checkOrganizationSlug(slug: string): Promise<ActionResult<boolean>> {
  return run(async () => {
    await requireSession();
    return !(await slugTaken(parse(OrgSlug, slug)));
  });
}

export async function createOrganizationAction(input: {
  name: string;
  slug?: string;
  teamName?: string;
}): Promise<ActionResult<{ id: string; slug: string }>> {
  return run(async () => {
    const name = parse(OrgName, input.name);
    const session = await requireSession();
    // The URL the user chose, or one derived from the name.
    const slug = parse(
      OrgSlug,
      input.slug?.trim() || slugify(name) || `org-${session.user.id.slice(0, 8)}`
    );
    if (await slugTaken(slug)) throw new DriveError("That URL is already taken. Choose another.");
    const org = await auth.api.createOrganization({
      body: { name, slug, userId: session.user.id },
      headers: await headers(),
    });
    // The wizard's optional first team (the plugin's default team is disabled).
    if (input.teamName?.trim()) {
      await auth.api.createTeam({
        body: {
          name: parse(TeamName, input.teamName),
          organizationId: org.id,
        },
        headers: await headers(),
      });
    }
    return { id: org.id, slug: org.slug };
  });
}

export async function inviteMembers(
  slug: string,
  input: { emails: string; role: string; teamId?: string }
): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireOrg(slug);
    requireManage(ctx.role);
    const list = parse(
      z.array(z.email("Enter valid email addresses.")).min(1).max(20),
      splitEmails(input.emails)
    );
    for (const email of list) {
      await auth.api.createInvitation({
        body: {
          email,
          role: parse(Role, input.role),
          organizationId: ctx.id,
          teamId: input.teamId || undefined,
          resend: true,
        },
        headers: await headers(),
      });
    }
  });
}

export async function cancelOrgInvitation(slug: string, id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireOrg(slug);
    requireManage(ctx.role);
    await cancelWorkspaceInvitation(ctx.id, id);
  });
}

export async function removeOrgMember(slug: string, memberId: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireOrg(slug);
    requireManage(ctx.role);
    await removeWorkspaceMember(ctx.id, memberId, "That person isn't in this organization.");
  });
}

export async function updateOrgMemberRole(
  slug: string,
  memberId: string,
  role: string
): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireOrg(slug);
    requireManage(ctx.role);
    await auth.api.updateMemberRole({
      body: {
        memberId: parse(Id, memberId),
        role: parse(Role, role),
        organizationId: ctx.id,
      },
      headers: await headers(),
    });
  });
}

// Deletes the organization and everything in it. Files leave its bucket first,
// then its storage connection; deleting the organization cascades the rest
// (members, invitations, teams, items, Locked folder PINs).
export async function deleteOrganizationAction(
  slug: string,
  confirmName: string
): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireOrg(slug);
    if (ctx.role !== "owner") throw new DriveError("Only the owner can delete this organization.");
    if (ctx.kind !== "organization") throw new DriveError("Personal drives can't be deleted.");
    if (confirmName.trim() !== ctx.name)
      throw new DriveError("Type the organization's name to confirm.");
    const rows = await db
      .select({ storageKey: driveItems.storageKey })
      .from(driveItems)
      .where(eq(driveItems.organizationId, ctx.id));
    const keys = rows.flatMap((r) => (r.storageKey ? [r.storageKey] : []));
    // Without a working connection the objects are unreachable anyway.
    const bucket = keys.length ? await workspaceBucket(ctx.id).catch(() => null) : null;
    if (bucket)
      await bucket.remove(keys).catch(() => {
        throw new DriveError(
          "Couldn't delete this organization's files from its bucket. Check the storage connection and try again."
        );
      });
    await db.delete(storageConnections).where(eq(storageConnections.organizationId, ctx.id));
    await auth.api.deleteOrganization({
      body: { organizationId: ctx.id },
      headers: await headers(),
    });
    await clearActiveWorkspace(ctx.id);
  });
}

// Pending invitations addressed to the signed-in user, across all workspaces.
export async function getMyInvitations(): Promise<ActionResult<MyInvitation[]>> {
  return run(async () => {
    const session = await requireSession();
    const rows = await db
      .select({
        id: invitations.id,
        organization: organizations.name,
        expiresAt: invitations.expiresAt,
      })
      .from(invitations)
      .innerJoin(organizations, eq(organizations.id, invitations.organizationId))
      .where(and(eq(invitations.email, session.user.email), isPendingInvitation()))
      .orderBy(asc(invitations.expiresAt));
    return rows.map((r) => ({
      id: r.id,
      organization: r.organization,
      expiresAt: r.expiresAt.toISOString(),
    }));
  });
}
