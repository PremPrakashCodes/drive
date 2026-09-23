import "server-only";

import { and, eq, gt } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import { driveItems, invitations, members, spaceLocks } from "@/db/schema";
import { auth } from "@/lib/auth";
import { atomically, Id, parse } from "@/lib/drive/action";
import { workspaceBucket } from "@/lib/drive/s3";
import { DriveError } from "@/lib/drive/workspace";

// Shared by personal drives and organizations. Callers check who may act.

// Invitations still waiting for an answer.
export const isPendingInvitation = () =>
  and(eq(invitations.status, "pending"), gt(invitations.expiresAt, new Date()));

// Private files belong to the person, not the drive: remove them when that
// person leaves (their Locked folder too), along with its PIN. Their shared
// files stay for everyone else.
export async function purgePrivateFiles(organizationId: string, userId: string) {
  const owned = and(
    eq(driveItems.organizationId, organizationId),
    eq(driveItems.createdById, userId),
    eq(driveItems.visibility, "private")
  );
  const rows = await db.select({ storageKey: driveItems.storageKey }).from(driveItems).where(owned);
  const keys = rows.flatMap((r) => (r.storageKey ? [r.storageKey] : []));
  // Resolved before anything is written — a read, not a write — so a drive
  // with no reachable storage purges nothing and the caller can stop.
  const bucket = keys.length ? await workspaceBucket(organizationId) : null;
  // The files and the PIN go in one batch: half of it would leave a Locked
  // folder that can't be opened, or items no one can reach.
  await atomically([
    db
      .delete(spaceLocks)
      .where(and(eq(spaceLocks.organizationId, organizationId), eq(spaceLocks.userId, userId))),
    db.delete(driveItems).where(owned),
  ]);
  // Objects last: a failure leaves bytes no row references, for the orphan
  // sweeper, rather than rows pointing at bytes that are already gone.
  if (bucket) await bucket.remove(keys);
}

export async function cancelWorkspaceInvitation(organizationId: string, id: string) {
  const invitationId = parse(Id, id);
  const [invitation] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(and(eq(invitations.id, invitationId), eq(invitations.organizationId, organizationId)));
  if (!invitation) throw new DriveError("That invitation no longer exists.");
  await auth.api.cancelInvitation({
    body: { invitationId },
    headers: await headers(),
  });
}

// Anyone but the owner; their private files (and Locked folder) leave with them.
export async function removeWorkspaceMember(
  organizationId: string,
  memberId: string,
  notFound: string
) {
  const [member] = await db
    .select({ id: members.id, userId: members.userId, role: members.role })
    .from(members)
    .where(and(eq(members.id, parse(Id, memberId)), eq(members.organizationId, organizationId)));
  if (!member) throw new DriveError(notFound);
  if (member.role === "owner") throw new DriveError("The owner can't be removed.");
  await auth.api.removeMember({
    body: { memberIdOrEmail: member.id, organizationId },
    headers: await headers(),
  });
  // The removal lands first. Purging ahead of it would destroy someone's files
  // and then, if the removal failed, leave them still in the drive without
  // them — for something they never asked for.
  await purgePrivateFiles(organizationId, member.userId);
}
