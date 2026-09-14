"use server";

import type {
  ActionResult,
  DriveInvitation,
  DriveMember,
  DriveOrganization,
  DriveTeam,
} from "@/lib/drive/types";
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { cookies, headers } from "next/headers";
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
import { Id, parse, run } from "@/lib/drive/action";
import { purgePrivateFiles } from "@/lib/drive/members";
import { workspaceBucket } from "@/lib/drive/s3";
import { DriveError, WORKSPACE_COOKIE } from "@/lib/drive/workspace";
import { OrgSlug, slugify } from "@/lib/workspace/org-slug";

const Role = z.enum(["owner", "admin", "member"]);
type Role = z.infer<typeof Role>;
const TeamColor = z.enum(["green", "purple", "amber", "blue"]);

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new DriveError("Your session expired. Sign in again.");
  return session;
}

// The organization named by the /org/[organization] route, membership-checked.
export async function requireOrg(
  slug: string
): Promise<{ id: string; name: string; slug: string; role: Role; userId: string }> {
  const session = await requireSession();
  const [row] = await db
    .select({ id: organizations.id, name: organizations.name, role: members.role })
    .from(members)
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
    .where(and(eq(members.userId, session.user.id), eq(organizations.slug, slug)));
  if (!row) throw new DriveError("That organization doesn't exist or you're not a member.");
  return {
    id: row.id,
    name: row.name,
    slug,
    role: Role.parse(row.role),
    userId: session.user.id,
  };
}

function requireManage(role: Role) {
  if (role === "member")
    throw new DriveError("Only the owner or an admin can manage this organization.");
}

const roleOf = (role: string | null | undefined) =>
  role === "owner"
    ? ("owner" as const)
    : role === "admin"
      ? ("admin" as const)
      : ("member" as const);

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
    const ids = rows.map((r) => r.id);
    const counts = ids.length
      ? await db
          .select({ organizationId: members.organizationId, userId: members.userId })
          .from(members)
          .where(inArray(members.organizationId, ids))
      : [];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      role: roleOf(r.role),
      members: counts.filter((c) => c.organizationId === r.id).length,
      createdAt: r.joinedAt.toISOString(),
    }));
  });
}

export async function getOrgOverview(slug: string): Promise<
  ActionResult<{
    organization: DriveOrganization;
    teams: DriveTeam[];
    members: DriveMember[];
    invitations: DriveInvitation[];
  }>
> {
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
            .where(
              and(
                eq(invitations.organizationId, ctx.id),
                eq(invitations.status, "pending"),
                gt(invitations.expiresAt, new Date())
              )
            )
            .orderBy(asc(invitations.expiresAt))
        : Promise.resolve(
            [] as {
              id: string;
              email: string;
              role: string | null;
              teamId: string | null;
              expiresAt: Date;
            }[]
          ),
      db
        .select({ teamId: teamMembers.teamId, userId: teamMembers.userId })
        .from(teamMembers)
        .innerJoin(teams, eq(teams.id, teamMembers.teamId))
        .where(eq(teams.organizationId, ctx.id)),
    ]);
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
        memberCount: teamMemberRows.filter((tm) => tm.teamId === t.id).length,
        createdAt: t.createdAt.toISOString(),
      })),
      members: memberRows.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.name,
        email: m.email,
        role: roleOf(m.role),
        joinedAt: m.joinedAt.toISOString(),
        teams: teamMemberRows.filter((tm) => tm.userId === m.userId).map((tm) => tm.teamId),
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
  emails?: string;
}): Promise<ActionResult<{ slug: string }>> {
  return run(async () => {
    const name = parse(
      z.string().trim().min(2, "Give your organization a name.").max(64),
      input.name
    );
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
          name: parse(z.string().trim().min(2).max(64), input.teamName),
          organizationId: org.id,
        },
        headers: await headers(),
      });
    }
    return { slug: org.slug };
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
      input.emails.split(/[;,\s]+/).filter(Boolean)
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
    const invitationId = parse(Id, id);
    const [invitation] = await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(and(eq(invitations.id, invitationId), eq(invitations.organizationId, ctx.id)));
    if (!invitation) throw new DriveError("That invitation no longer exists.");
    await auth.api.cancelInvitation({
      body: { invitationId },
      headers: await headers(),
    });
  });
}

export async function removeOrgMember(slug: string, memberId: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireOrg(slug);
    requireManage(ctx.role);
    const id = parse(Id, memberId);
    const [member] = await db
      .select({ id: members.id, userId: members.userId, role: members.role })
      .from(members)
      .where(and(eq(members.id, id), eq(members.organizationId, ctx.id)));
    if (!member) throw new DriveError("That person isn't in this organization.");
    if (member.role === "owner") throw new DriveError("The owner can't be removed.");
    await auth.api.removeMember({
      body: { memberIdOrEmail: member.id, organizationId: ctx.id },
      headers: await headers(),
    });
    // Their private files (and Locked folder) leave with them.
    await purgePrivateFiles(ctx.id, member.userId);
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

export async function createTeamAction(
  slug: string,
  input: { name: string; description?: string; color?: string }
): Promise<ActionResult<DriveTeam>> {
  return run(async () => {
    const ctx = await requireOrg(slug);
    requireManage(ctx.role);
    const name = parse(z.string().trim().min(2, "Give your team a name.").max(64), input.name);
    const description = parse(z.string().trim().max(200).optional(), input.description);
    const color = input.color ? parse(TeamColor, input.color) : undefined;
    const [existing] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.organizationId, ctx.id), eq(teams.name, name)));
    if (existing) throw new DriveError("A team with that name already exists.");
    const team = await auth.api.createTeam({
      body: { name, organizationId: ctx.id },
      headers: await headers(),
    });
    const [row] = await db
      .update(teams)
      .set({ description: description ?? null, color: color ?? null })
      .where(eq(teams.id, team.id))
      .returning({
        id: teams.id,
        name: teams.name,
        description: teams.description,
        color: teams.color,
        memberCount: teams.memberCount,
        createdAt: teams.createdAt,
      });
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      color: row.color,
      memberCount: row.memberCount,
      createdAt: row.createdAt.toISOString(),
    };
  });
}

export async function removeTeamAction(slug: string, teamId: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireOrg(slug);
    requireManage(ctx.role);
    await auth.api.removeTeam({
      body: { teamId: parse(Id, teamId), organizationId: ctx.id },
      headers: await headers(),
    });
  });
}

export async function addTeamMemberAction(
  slug: string,
  teamId: string,
  userId: string
): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireOrg(slug);
    requireManage(ctx.role);
    const [membership] = await db
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.userId, parse(Id, userId)), eq(members.organizationId, ctx.id)));
    if (!membership) throw new DriveError("That person isn't in this organization.");
    await auth.api.addTeamMember({
      body: { teamId: parse(Id, teamId), userId, organizationId: ctx.id },
      headers: await headers(),
    });
  });
}

export async function removeTeamMemberAction(
  slug: string,
  teamId: string,
  userId: string
): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireOrg(slug);
    requireManage(ctx.role);
    await auth.api.removeTeamMember({
      body: { teamId: parse(Id, teamId), userId, organizationId: ctx.id },
      headers: await headers(),
    });
  });
}

export async function leaveOrganizationAction(slug: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await requireOrg(slug);
    if (ctx.role === "owner")
      throw new DriveError("The owner can't leave. Delete the organization instead.");
    await auth.api.leaveOrganization({
      body: { organizationId: ctx.id },
      headers: await headers(),
    });
    await purgePrivateFiles(ctx.id, ctx.userId);
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
    const [org] = await db
      .select({ kind: organizations.kind })
      .from(organizations)
      .where(eq(organizations.id, ctx.id));
    if (org?.kind !== "organization") throw new DriveError("Personal drives can't be deleted.");
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
    const jar = await cookies();
    if (jar.get(WORKSPACE_COOKIE)?.value === ctx.id) jar.delete(WORKSPACE_COOKIE);
  });
}

// Pending invitations addressed to the signed-in user, across all workspaces.
export async function getMyInvitations(): Promise<
  ActionResult<{ id: string; organization: string; expiresAt: string }[]>
> {
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
      .where(
        and(
          eq(invitations.email, session.user.email),
          eq(invitations.status, "pending"),
          gt(invitations.expiresAt, new Date())
        )
      )
      .orderBy(asc(invitations.expiresAt));
    return rows.map((r) => ({
      id: r.id,
      organization: r.organization,
      expiresAt: r.expiresAt.toISOString(),
    }));
  });
}
