import "server-only";

import { and, count, eq, gte } from "drizzle-orm";

import { db } from "@/db";
import { invitations } from "@/db/schema";
import { DriveError } from "@/lib/drive/workspace";

// Every person owns the personal drive created for them, so inviting is always
// within reach, and both invite paths call the endpoint directly rather than
// over HTTP — the framework's limiter never sees them. This is the limit that
// does, counted per sender rather than per address.
export const INVITE_WINDOW_MS = 60 * 60 * 1000;
export const INVITE_MAX_PER_WINDOW = 30;

/** How many more invitation emails a sender may send in the current window. */
export const invitesRemaining = (recentlySent: number) =>
  Math.max(0, INVITE_MAX_PER_WINDOW - recentlySent);

/**
 * What to tell a sender asking to send `sending` invitations, or `null` when
 * there is room for all of them. A batch is refused whole: sending part of it
 * and reporting a failure would leave the sender guessing which addresses got
 * an email.
 */
export function inviteQuotaRefusal(recentlySent: number, sending: number): string | null {
  const remaining = invitesRemaining(recentlySent);
  if (sending <= remaining) return null;
  if (remaining === 0)
    return `You've sent ${INVITE_MAX_PER_WINDOW} invitations in the past hour. Try again later.`;
  return `You can send ${remaining} more invitation${remaining === 1 ? "" : "s"} this hour — you asked to send ${sending}.`;
}

/**
 * Counts what this sender has sent recently and refuses the batch if it
 * doesn't fit. The count is every invitation of theirs written inside the
 * window, whatever became of it: creating one inserts a row and re-sending
 * touches it, so a row is one email that went out. Status is deliberately not
 * filtered — an email a sender cancels afterwards was still sent, and counting
 * only pending rows would let them cancel their way back to a full allowance.
 */
export async function requireInviteQuota(inviterId: string, sending: number): Promise<void> {
  const since = new Date(Date.now() - INVITE_WINDOW_MS);
  const [row] = await db
    .select({ sent: count() })
    .from(invitations)
    .where(and(eq(invitations.inviterId, inviterId), gte(invitations.updatedAt, since)));
  const refusal = inviteQuotaRefusal(row?.sent ?? 0, sending);
  if (refusal) throw new DriveError(refusal);
}
