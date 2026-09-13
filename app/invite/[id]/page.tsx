import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { invitations, organizations, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isDatePast } from "@/lib/date";
import { InviteActions } from "./invite-actions";

export const metadata: Metadata = { title: "Join a drive" };

export default async function InvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(`/sign-in?${new URLSearchParams({ next: `/invite/${id}` })}`);

  const [invite] = /^[0-9a-f-]{36}$/i.test(id)
    ? await db
        .select({
          email: invitations.email,
          status: invitations.status,
          expiresAt: invitations.expiresAt,
          workspace: organizations.name,
          inviter: users.name,
        })
        .from(invitations)
        .innerJoin(organizations, eq(organizations.id, invitations.organizationId))
        .innerJoin(users, eq(users.id, invitations.inviterId))
        .where(eq(invitations.id, id))
    : [];

  // Only the invited address sees who sent it and for which drive.
  const forYou = invite?.email.toLowerCase() === session.user.email.toLowerCase();
  const problem = !invite
    ? "This invitation doesn't exist or was cancelled."
    : !forYou
      ? `This invitation was sent to a different email address. You're signed in as ${session.user.email}.`
      : invite.status !== "pending"
        ? `This invitation was already ${invite.status}.`
        : isDatePast(invite.expiresAt)
          ? "This invitation has expired. Ask for a new one."
          : null;

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background">
      <header className="px-6 py-6 sm:px-10">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Drive<span className="text-muted-foreground">.</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pt-8 pb-20 sm:pb-28">
        <div className="w-full max-w-sm">
          {problem || !invite ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">
                Can&apos;t open this invitation
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{problem}</p>
              <Button
                className="mt-6"
                variant="outline"
                nativeButton={false}
                render={<Link href="/drive" />}
              >
                Go to my drive
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">Join {invite.workspace}</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {invite.inviter} invited you. You&apos;ll see everything shared in this drive and
                can add your own files. Anything you mark private stays visible only to you.
              </p>
              <div className="mt-6">
                <InviteActions id={id} />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
