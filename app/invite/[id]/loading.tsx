import { Skeleton } from "@/components/ui/skeleton";

// The invitation page checks the session and reads the invitation before it
// can say anything, and it is usually opened cold from an email link — so it
// is the one route where a blank wait is most likely. This mirrors its layout:
// the same header, and a card-sized block where the invitation will be.
export default function Loading() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background">
      <header className="px-6 py-6 sm:px-10">
        <span className="text-lg font-semibold tracking-tight">
          Drive<span className="text-muted-foreground">.</span>
        </span>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pt-8 pb-20 sm:pb-28">
        <div className="w-full max-w-sm" aria-busy="true" aria-label="Loading invitation">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-11/12" />
          <Skeleton className="mt-2 h-4 w-3/4" />
          <Skeleton className="mt-6 h-8 w-36" />
        </div>
      </main>
    </div>
  );
}
