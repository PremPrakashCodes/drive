import { Skeleton } from "@/components/ui/skeleton";

// The drive shell keeps rendering above this, so no page padding here — the
// shell already supplies it. The shape follows the file browser's own loading
// state (components/files/file-browser.tsx), which is what most sections show
// once they hydrate, so the two don't jump as one replaces the other.
//
// The boundary lives here rather than at the group level: the protected layout
// reads the session, and Next blocks navigation on a layout's runtime data
// instead of showing a fallback beside it.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-12 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-44" />
        ))}
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  );
}
