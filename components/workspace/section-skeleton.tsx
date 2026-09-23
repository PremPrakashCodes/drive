import { Skeleton } from "@/components/ui/skeleton";

// The shape a drive section shows while its data is on the way: a heading, a
// row of summary cards, and the body below them.
//
// Shared by the route's `loading.tsx` (the server wait) and by pages that
// wait again on the client for the workspace listing, so the two are the same
// picture and nothing jumps as one hands over to the other. It matters that
// this is a skeleton and not the page with zeros in it: "0 B used" and "Not
// connected" are answers, and a person cannot tell an answer that is still
// arriving from one that is true.
export function SectionSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-12 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: cards }, (_, i) => (
          <Skeleton key={i} className="h-44" />
        ))}
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  );
}
