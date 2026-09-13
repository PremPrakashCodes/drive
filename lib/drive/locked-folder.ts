"use server";

import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { z } from "zod";
import { db } from "@/db";
import { accounts, spaceLocks, type SpaceLock } from "@/db/schema";
import { parse, run } from "@/lib/drive/action";
import type { ActionResult } from "@/lib/drive/types";
import { getSpaceLock, grantUnlock, revokeUnlock } from "@/lib/drive/unlock";
import {
  DriveError,
  requireWorkspace,
  type Workspace,
} from "@/lib/drive/workspace";

const Pin = z.string().regex(/^\d{6}$/, "Enter a 6-digit PIN.");
const AccountPassword = z
  .string()
  .min(1, "Enter your account password.")
  .max(256, "That isn't your account password.");

function inAbout(date: Date | null | undefined) {
  const seconds = Math.max(
    1,
    Math.ceil(((date?.getTime() ?? 0) - Date.now()) / 1000),
  );
  if (seconds < 60) return `in ${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

// Counts the try before checking it, in one conditional update that's refused
// while backing off, so parallel guesses can't slip past the limit. After 5
// wrong tries in a row: wait 30 seconds, doubling each time, up to an hour.
async function attempt(
  lock: SpaceLock,
  check: () => Promise<boolean>,
  wrong: string,
) {
  const where = and(
    eq(spaceLocks.userId, lock.userId),
    eq(spaceLocks.organizationId, lock.organizationId),
  );
  const failed = sql`${spaceLocks.failedAttempts} + 1`;
  const [claimed] = await db
    .update(spaceLocks)
    .set({
      failedAttempts: failed,
      retryAfter: sql`case when ${failed} >= 5 then now() + make_interval(secs => least(30 * power(2, ${failed} - 5), 3600)) end`,
    })
    .where(
      and(
        where,
        or(
          isNull(spaceLocks.retryAfter),
          lte(spaceLocks.retryAfter, sql`now()`),
        ),
      ),
    )
    .returning({ userId: spaceLocks.userId });
  if (!claimed) {
    const [row] = await db
      .select({ retryAfter: spaceLocks.retryAfter })
      .from(spaceLocks)
      .where(where);
    throw new DriveError(
      `Too many wrong tries. Try again ${inAbout(row?.retryAfter)}.`,
    );
  }
  if (!(await check())) throw new DriveError(wrong);
  await db
    .update(spaceLocks)
    .set({ failedAttempts: 0, retryAfter: null })
    .where(where);
}

async function verifyAccountPassword(userId: string, password: string) {
  const [account] = await db
    .select({ password: accounts.password })
    .from(accounts)
    .where(
      and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")),
    );
  if (!account?.password)
    throw new DriveError(
      "Your account doesn't have a password to confirm with.",
    );
  return verifyPassword({ hash: account.password, password });
}

async function requireLock(ws: Workspace) {
  const lock = await getSpaceLock(ws.userId, ws.id);
  if (!lock) throw new DriveError("Set up your Locked folder first.");
  return lock;
}

// The new hash ends unlocks on other devices; this one stays unlocked.
async function replacePin(lock: SpaceLock, pin: string) {
  const [updated] = await db
    .update(spaceLocks)
    .set({
      secretHash: await hashPassword(pin),
      failedAttempts: 0,
      retryAfter: null,
    })
    .where(
      and(
        eq(spaceLocks.userId, lock.userId),
        eq(spaceLocks.organizationId, lock.organizationId),
      ),
    )
    .returning();
  await grantUnlock(updated);
}

export async function setUpLockedFolder(pin: string): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    const value = parse(Pin, pin);
    const [lock] = await db
      .insert(spaceLocks)
      .values({
        userId: ws.userId,
        organizationId: ws.id,
        secretHash: await hashPassword(value),
      })
      .onConflictDoNothing()
      .returning();
    if (!lock) throw new DriveError("Your Locked folder already has a PIN.");
    await grantUnlock(lock);
  });
}

export async function unlockLockedFolder(pin: string): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    const lock = await requireLock(ws);
    const value = parse(Pin, pin);
    await attempt(
      lock,
      () => verifyPassword({ hash: lock.secretHash, password: value }),
      "That PIN isn't right.",
    );
    await grantUnlock(lock);
  });
}

export async function lockLockedFolder(): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    await revokeUnlock(ws.id);
  });
}

export async function changeLockedFolderPin(input: {
  current: string;
  pin: string;
}): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    const lock = await requireLock(ws);
    const current = parse(Pin, input.current);
    const pin = parse(Pin, input.pin);
    await attempt(
      lock,
      () => verifyPassword({ hash: lock.secretHash, password: current }),
      "Your current PIN isn't right.",
    );
    await replacePin(lock, pin);
  });
}

// Forgot the PIN: your account password sets a new one. Files stay locked.
export async function resetLockedFolderPin(input: {
  accountPassword: string;
  pin: string;
}): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    const lock = await requireLock(ws);
    const password = parse(AccountPassword, input.accountPassword);
    const pin = parse(Pin, input.pin);
    await attempt(
      lock,
      () => verifyAccountPassword(ws.userId, password),
      "That isn't your account password.",
    );
    await replacePin(lock, pin);
  });
}
