"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

// The body of every route-level error boundary.
//
// `retry` is Next's stable prop since 16.3: unlike `reset`, it re-fetches the
// segment as well as re-rendering it, so a failure that was only the moment —
// a dropped database connection, a slow upstream — clears without the person
// reloading the whole page and losing where they were.
//
// The thrown message is deliberately not shown: server errors reach the client
// masked in production anyway, and the digest is what matches a server log.
export function ErrorState({
  error,
  retry,
  title,
  description,
  children,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  useEffect(() => {
    console.error("[drive] render failed", error);
  }, [error]);
  return (
    <Empty className="min-h-64">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlert />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex items-center gap-2">
          <Button onClick={() => retry()}>
            <RotateCcw data-icon="inline-start" />
            Try again
          </Button>
          {children}
        </div>
        {error.digest && <p className="text-xs text-muted-foreground">Reference {error.digest}</p>}
      </EmptyContent>
    </Empty>
  );
}
