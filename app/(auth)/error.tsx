"use client";

import Link from "next/link";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";

// Signing in is the one thing a person can't route around, so this boundary
// keeps the auth shell and always offers the way back to sign-in.
export default function AuthError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState
      error={error}
      retry={retry}
      title="Something went wrong"
      description="We couldn't load this step. Your account is unaffected — try again, or start from sign-in."
    >
      <Button variant="outline" nativeButton={false} render={<Link href="/sign-in" />}>
        Back to sign in
      </Button>
    </ErrorState>
  );
}
