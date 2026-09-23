"use client";

import Link from "next/link";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";

// The backstop for everything the two group boundaries don't cover: the
// invitation page, and a failure in a group's own layout. Without it those
// throws would fall through to `global-error`, which replaces the root layout
// and drops the person out of the application entirely.
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-background px-6">
      <ErrorState
        error={error}
        retry={retry}
        title="Something went wrong"
        description="This page didn't load. Nothing was changed. Try again, or head back to your drive."
      >
        <Button variant="outline" nativeButton={false} render={<Link href="/drive" />}>
          Go to my drive
        </Button>
      </ErrorState>
    </div>
  );
}
