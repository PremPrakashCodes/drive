"use server";

import { and, eq, gt } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { sessions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { parse, run } from "@/lib/drive/action";
import { DriveError, requireSession } from "@/lib/drive/workspace";

const sessionId = z.uuid("That session no longer exists.");

// Every active session for the signed-in account. The cookie-based
// multi-session endpoint only knows about browsers that opted into account
// switching, so the table is the source of truth here. Tokens stay on the
// server; the client only learns which row is the current session.
export async function listAuthSessions() {
  return run(async () => {
    const current = await requireSession();
    const rows = await db
      .select({
        id: sessions.id,
        userAgent: sessions.userAgent,
        createdAt: sessions.createdAt,
        updatedAt: sessions.updatedAt,
        token: sessions.token,
      })
      .from(sessions)
      .where(and(eq(sessions.userId, current.user.id), gt(sessions.expiresAt, new Date())));

    return rows
      .map(({ token, ...session }) => ({ ...session, isCurrent: token === current.session.token }))
      .sort(
        (a, b) =>
          Number(b.isCurrent) - Number(a.isCurrent) || b.createdAt.getTime() - a.createdAt.getTime()
      );
  });
}

// Signs one other device out by row id, after re-checking that the row
// exists, belongs to this account, and isn't the session making the request.
export async function revokeAuthSession(input: { id: string }) {
  return run(async () => {
    const current = await requireSession();
    const id = parse(sessionId, input.id);
    const [row] = await db
      .select({ userId: sessions.userId })
      .from(sessions)
      .where(eq(sessions.id, id));
    if (!row || row.userId !== current.user.id)
      throw new DriveError("That session no longer exists.");
    if (id === current.session.id) throw new DriveError("Use sign out to end the current session.");
    await db.delete(sessions).where(eq(sessions.id, id));
  });
}

// nextCookies() in lib/auth.ts forwards the cleared session cookies set by
// auth.api.signOut to the response.
export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/sign-in");
}
