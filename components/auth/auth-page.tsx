import type { AuthMode } from "@/lib/auth-form";
import { ArrowLeftIcon, CheckCircle2Icon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { auth } from "@/lib/auth";
import { safeRedirect } from "@/lib/auth-form";

const content = {
  "sign-in": {
    title: "Welcome back",
    description: "Sign in to your Drive account.",
  },
  "sign-up": {
    title: "Create an account",
    description: "Your files, all in one place.",
  },
  "forgot-password": {
    title: "Forgot your password?",
    description: "Enter your email to receive a reset link.",
  },
  "reset-password": {
    title: "Set a new password",
    description: "Choose a new password for your Drive account.",
  },
};
export type AuthSearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function AuthPage({
  mode,
  searchParams,
}: {
  mode: AuthMode;
  searchParams: AuthSearchParams;
}) {
  const params = await searchParams;
  const next = safeRedirect(params.next);
  if (mode === "sign-in" || mode === "sign-up") {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session) redirect(next);
  }
  const token = typeof params.token === "string" ? params.token : undefined;
  const invalidLink = mode === "reset-password" && (!token || !!params.error);
  const { title, description } = content[mode];
  const accountPage = mode === "sign-in" || mode === "sign-up";
  const alternateHref = `${mode === "sign-in" ? "/sign-up" : "/sign-in"}${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;
  return (
    <section className="flex flex-col gap-8" aria-labelledby="auth-title">
      <header className="flex flex-col gap-2">
        <h1 id="auth-title" className="text-3xl font-semibold tracking-tight">
          {invalidLink ? "Request a new link" : title}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {invalidLink ? "This password reset link is missing, invalid, or expired." : description}
        </p>
      </header>
      <div className="flex flex-col gap-5">
        {mode === "sign-in" && params.reset === "success" && (
          <Alert>
            <CheckCircle2Icon />
            <AlertTitle>Password updated</AlertTitle>
            <AlertDescription>Sign in with your new password to continue.</AlertDescription>
          </Alert>
        )}
        {invalidLink ? (
          <Link
            href="/forgot-password"
            className="text-sm font-medium underline underline-offset-4"
          >
            Request a new reset link →
          </Link>
        ) : (
          <AuthForm mode={mode} next={next} token={token} />
        )}
      </div>
      <footer className="flex justify-center">
        {accountPage ? (
          <p className="text-center text-sm text-muted-foreground">
            {mode === "sign-in" ? "New to Drive?" : "Already have an account?"}{" "}
            <Link
              href={alternateHref}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {mode === "sign-in" ? "Create an account" : "Sign in"}
            </Link>
          </p>
        ) : (
          <Link
            href="/sign-in"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" />
            Back to sign in
          </Link>
        )}
      </footer>
    </section>
  );
}
