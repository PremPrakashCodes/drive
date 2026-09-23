import { SectionSkeleton } from "@/components/workspace/section-skeleton";

// The drive shell keeps rendering above this, so no page padding here — the
// shell already supplies it. The shape follows the file browser's own loading
// state (components/files/file-browser.tsx), which is what most sections show
// once they hydrate, so the two don't jump as one replaces the other. The
// storage page waits on the same shape again while its listing arrives.
//
// The boundary lives here rather than at the group level: the protected layout
// reads the session, and Next blocks navigation on a layout's runtime data
// instead of showing a fallback beside it.
export default function Loading() {
  return <SectionSkeleton />;
}
