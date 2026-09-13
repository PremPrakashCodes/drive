import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

const ERROR_MESSAGES: Record<string, string> = {
  TOKEN_EXPIRED:
    "This verification link has expired. Sign in to request a new one.",
  INVALID_TOKEN: "This verification link is invalid or has already been used.",
  USER_NOT_FOUND: "We couldn't find an account for this link.",
  INVALID_USER: "This link doesn't match your account. Try signing in again.",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const failed = Boolean(error);
  const message = error
    ? (ERROR_MESSAGES[error] ?? "Email verification failed.")
    : null;

  return (
    <section
      className="flex flex-col gap-8"
      aria-labelledby="verification-title"
    >
      <header className="flex flex-col gap-2">
        <h1
          id="verification-title"
          className="text-3xl font-semibold tracking-tight"
        >
          {failed ? "Verification failed" : "Email verified"}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {failed ? message : "Your email is confirmed — you're all set."}
        </p>
      </header>
      <Link
        href={failed ? "/sign-in" : "/"}
        className={buttonVariants({ size: "lg", className: "h-11 w-full" })}
      >
        {failed ? "Go to sign in" : "Continue to Drive"}
      </Link>
    </section>
  );
}
