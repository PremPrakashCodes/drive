import type { Metadata } from "next";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const firstName = session?.user.name?.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome back, {firstName}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          This area is protected — you&apos;re signed in as{" "}
          <span className="font-medium text-foreground">
            {session?.user.email}
          </span>
          .
        </p>
      </div>
      <div className="rounded-xl border bg-card p-6 text-sm leading-relaxed text-card-foreground">
        <h2 className="mb-2 font-semibold">Getting started</h2>
        <p className="text-muted-foreground">
          Files, uploads, and sharing will live here. The route is guarded in
          two layers: a cookie check in <code>proxy.ts</code> for fast
          redirects, and a database-backed session validation in the
          dashboard layout.
        </p>
        <a
          href="https://better-auth.com/docs/integrations/next"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "mt-4",
          )}
        >
          Better Auth + Next.js docs
        </a>
      </div>
    </div>
  );
}
