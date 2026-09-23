"use client";

import Link from "next/link";

import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";

// Wraps every page in the drive. The layout above it — sidebar, header,
// uploads — keeps rendering, so a page that throws costs the person the panel
// they were looking at, not the application.
export default function DriveError({
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
      title="This page didn't load"
      description="Your files are safe and nothing was changed. Try again, or open another section from the sidebar."
    >
      <Button variant="outline" nativeButton={false} render={<Link href="/drive" />}>
        Go to my drive
      </Button>
    </ErrorState>
  );
}
