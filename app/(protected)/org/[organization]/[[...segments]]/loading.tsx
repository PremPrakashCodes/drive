import { OrgOverviewSkeleton } from "@/components/workspace/org/org-skeleton";

// Every page under an organization route: overview, members, teams, settings,
// storage and the file browser. The overview's shape is the one people land on
// first, and it is close enough to the rest that nothing lurches.
export default function Loading() {
  return <OrgOverviewSkeleton />;
}
