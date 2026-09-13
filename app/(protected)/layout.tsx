import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { WorkspaceShell } from "@/components/workspace/shell";
import { auth } from "@/lib/auth";
import { safeRedirect } from "@/lib/auth-form";
import { signOutAction } from "./actions";

// Authoritative gate for every route in this group. The proxy only performs a
// fast cookie check; this is where the session is actually validated against
// the database.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) {
    const next = safeRedirect(requestHeaders.get("x-auth-return-to"));
    redirect(`/sign-in?${new URLSearchParams({ next })}`);
  }

  const cookieStore = await cookies();

  return (
    <WorkspaceShell
      remote
      user={{ name: session.user.name, email: session.user.email }}
      signOutAction={signOutAction}
      defaultOpen={cookieStore.get("sidebar_state")?.value !== "false"}
    >
      {children}
    </WorkspaceShell>
  );
}
