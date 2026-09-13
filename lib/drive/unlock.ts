import "server-only";

import type { SpaceLock } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cache } from "react";

import { db } from "@/db";
import { spaceLocks } from "@/db/schema";
import { auth } from "@/lib/auth";

// An unlocked Locked folder stays open this long without activity; every
// request pushes it forward.
export const UNLOCK_IDLE_MS = 15 * 60 * 1000;

const cookieName = (spaceId: string) => `drive-locked-folder-${spaceId}`;

// Your Locked folder PIN in a space, if you've set one up.
export const getSpaceLock = cache(async (userId: string, spaceId: string) => {
  const [lock] = await db
    .select()
    .from(spaceLocks)
    .where(and(eq(spaceLocks.userId, userId), eq(spaceLocks.organizationId, spaceId)));
  return lock ?? null;
});

async function sign(lock: SpaceLock, expires: number) {
  const { secret } = await auth.$context;
  return createHmac("sha256", secret)
    .update(`${lock.userId}:${lock.organizationId}:${expires}:${lock.secretHash}`)
    .digest("base64url");
}

// Only callable from Server Actions (it sets a cookie). Returns the expiry.
export async function grantUnlock(lock: SpaceLock) {
  const expires = Date.now() + UNLOCK_IDLE_MS;
  (await cookies()).set(
    cookieName(lock.organizationId),
    `${expires}.${await sign(lock, expires)}`,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      // No maxAge: closing the browser locks the folder too.
    }
  );
  return expires;
}

export async function revokeUnlock(spaceId: string) {
  (await cookies()).delete(cookieName(spaceId));
}

// When this request's unlock expires (renewed, since this is activity), or
// null if the folder is locked.
export async function activeUnlock(lock: SpaceLock) {
  const value = (await cookies()).get(cookieName(lock.organizationId))?.value;
  const [raw, signature] = value?.split(".") ?? [];
  const expires = Number(raw);
  if (!signature || !Number.isSafeInteger(expires) || expires <= Date.now()) return null;
  const expected = Buffer.from(await sign(lock, expires));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return grantUnlock(lock);
}

// When your Locked folder's unlock expires, or null while it's locked or has
// no PIN. Server Actions only, since checking renews the unlock.
export const lockedFolderOpen = cache(async (userId: string, spaceId: string) => {
  const lock = await getSpaceLock(userId, spaceId);
  return lock && activeUnlock(lock);
});
