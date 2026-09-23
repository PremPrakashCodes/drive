import { Skeleton } from "@/components/ui/skeleton";

// The shape of an organization's overview while it is still being fetched.
//
// Shared by the route's `loading.tsx` (the server wait) and the page itself
// (the client wait for the overview), so the two are the same picture and
// nothing jumps as one hands over to the other. It matters that this is a
// skeleton and not a bare heading: an organization with no teams and no files
// renders real, empty sections, and a person has to be able to tell "still
// arriving" from "nothing here".
export function OrgOverviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading organization">
      <div className="mb-7.25 flex items-start justify-between gap-6 max-md:mb-5.75">
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-2.5 w-36" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-3.5 w-52" />
        </div>
        <Skeleton className="h-8.75 w-32" />
      </div>
      <div className="grid grid-cols-4 gap-4 max-[1000px]:grid-cols-[repeat(2,1fr)]">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
      <Skeleton className="mt-8.5 h-56 w-full" />
      <Skeleton className="mt-8.5 h-48 w-full" />
    </div>
  );
}
