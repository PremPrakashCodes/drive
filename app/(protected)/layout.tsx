import type { ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { safeRedirect } from "@/lib/auth-form";
import { Button } from "@/components/ui/button";
import { signOutAction } from "./actions";

// Authoritative gate for every route in this group. The proxy only performs a
// fast cookie check; this is where the session is actually validated against
// the database.
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    const next = safeRedirect(requestHeaders.get("x-auth-return-to"));
    redirect(`/sign-in?${new URLSearchParams({ next })}`);
  }

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background">
      <header className="flex items-center justify-between gap-4 border-b px-6 py-4 sm:px-10">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          Drive<span className="text-muted-foreground">.</span>
        </Link>
        <div className="flex items-center gap-3">
          <span
            className="hidden max-w-48 truncate text-sm text-muted-foreground sm:inline"
            title={session.user.email}
          >
            {session.user.email}
          </span>
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="flex flex-1 flex-col px-6 py-8 sm:px-10">
        {children}
      </main>
    </div>
  );
}
