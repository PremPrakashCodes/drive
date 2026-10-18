"use client";

import type { DriveTeam, WorkspaceContextValue } from "@/types";
import type { ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";

import { toDriveFiles } from "@/lib/workspace/listing";
import { useWorkspaceRoute } from "./route";
import { useOrganizationOverview } from "./use-organization-overview";
import { useWorkspaceData } from "./use-workspace-data";
import { useWorkspaceNavigation } from "./use-workspace-navigation";

const noTeams: DriveTeam[] = [];
const Store = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  children,
  user,
}: {
  children: ReactNode;
  user: WorkspaceContextValue["user"];
}) {
  const { data, loaded, listing, reload, run } = useWorkspaceData();
  const { org } = useWorkspaceRoute();
  const organization = useOrganizationOverview(org);
  const orgOverview = organization.overview;
  const { aligned, switching, navigateWorkspace } = useWorkspaceNavigation({
    organizations: data.organizations,
    listing,
    reload,
    run,
  });
  const files = useMemo(() => (listing ? toDriveFiles(listing) : []), [listing]);
  const value = useMemo(
    () => ({
      data: { ...data, files, teams: orgOverview?.teams ?? noTeams },
      organization,
      loaded: loaded && listing !== null && aligned && !switching,
      user,
      drive: { listing, reload, run, navigateWorkspace },
    }),
    [
      data,
      files,
      orgOverview,
      organization,
      loaded,
      listing,
      aligned,
      switching,
      user,
      reload,
      run,
      navigateWorkspace,
    ]
  );
  return <Store.Provider value={value}>{children}</Store.Provider>;
}
export function useWorkspace() {
  const context = useContext(Store);
  if (!context) throw new Error("WorkspaceProvider is required");
  return context;
}
