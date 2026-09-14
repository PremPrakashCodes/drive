"use client";

import type {
  ActionResult,
  DriveFile,
  DriveListing,
  DriveTeam,
  OrgOverview,
  WorkspaceData,
  WorkspaceDrive,
} from "@/types";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { getDrive } from "@/lib/drive/drive-listing";
import { switchSpace } from "@/lib/drive/items";
import { getMyInvitations, getOrgOverview, getOrganizations } from "@/lib/drive/org";
import { activeStorage } from "@/lib/workspace/providers";
import { useWorkspaceRoute } from "./route";

// The organization a route names, by slug (or id).
export function findOrganization<T extends { id: string; slug: string }>(
  orgs: T[],
  slugOrId: string | null | undefined
) {
  return slugOrId ? orgs.find((o) => o.slug === slugOrId || o.id === slugOrId) : undefined;
}

// The theme lives on this device (set from the shell's toggle).
function readTheme(): string | undefined {
  try {
    return localStorage.getItem("drive-theme") ?? undefined;
  } catch {
    return undefined;
  }
}

// Everything comes from the server: the open drive's listing, the user's
// organizations and their teams, and pending invitations addressed to them.
// Only UI preferences stay on this device.
const noTeams: DriveTeam[] = [];
const initial: WorkspaceData = {
  organizations: [],
  preferences: {},
  invitations: [],
};
const Store = createContext<{
  data: WorkspaceData & { files: DriveFile[]; teams: DriveTeam[] };
  // The open org route's overview, shared by the sidebar and the org pages.
  organization: { overview: OrgOverview | null; reload: () => Promise<void> };
  update: (fn: (data: WorkspaceData) => WorkspaceData) => void;
  loaded: boolean;
  user: { name: string; email: string };
  drive: WorkspaceDrive;
} | null>(null);
function toDriveFiles(listing: DriveListing): DriveFile[] {
  const provider = activeStorage(listing.storage)?.provider.name ?? "No storage connected";
  return listing.items.map((i) => ({
    id: i.id,
    name: i.name,
    kind: i.kind,
    size: i.size,
    modified: i.updatedAt,
    owner: i.createdByName,
    ownerId: i.createdById,
    parent: i.parentId,
    starred: i.starred,
    // "Shared with me": what other people added for everyone.
    shared: i.visibility === "shared" && i.createdById !== listing.workspace.userId,
    trashed: i.trashedAt !== null,
    deletedAt: i.trashedAt ?? undefined,
    provider,
    color: i.color ?? undefined,
    mime: i.mimeType ?? undefined,
    visibility: i.visibility,
    canEdit: i.canEdit,
    locked: i.locked,
  }));
}
export function WorkspaceProvider({
  children,
  user,
}: {
  children: ReactNode;
  user: { name: string; email: string };
}) {
  const [data, setData] = useState<WorkspaceData>(initial);
  const [loaded, setLoaded] = useState(false);
  const [listing, setListing] = useState<DriveListing | null>(null);
  const { org } = useWorkspaceRoute();
  const reload = useCallback(async () => {
    const [driveResult, orgsResult, invitesResult] = await Promise.all([
      getDrive(),
      getOrganizations(),
      getMyInvitations(),
    ]);
    if (driveResult.ok) setListing(driveResult.data);
    else toast.error(driveResult.error);
    if (orgsResult.ok) setData((d) => ({ ...d, organizations: orgsResult.data }));
    if (invitesResult.ok) setData((d) => ({ ...d, invitations: invitesResult.data }));
    // Mark hydration done once the first load settles, whatever it returned.
    setLoaded(true);
  }, []);
  // While an org route is open, the listing must be for that org: the
  // WORKSPACE_COOKIE is switched (like the sidebar does) before reloading.
  const aligned = !org || listing?.workspace.id === findOrganization(data.organizations, org)?.id;
  const [aligning, setAligning] = useState(false);
  const syncSpace = useCallback(
    async (slug: string) => {
      const target = findOrganization(data.organizations, slug);
      if (!target || listing?.workspace.id === target.id) return;
      setAligning(true);
      const result = await switchSpace(target.id);
      if (!result.ok) toast.error(result.error);
      await reload();
      setAligning(false);
    },
    [data.organizations, listing, reload]
  );
  /* eslint-disable react-hooks/set-state-in-effect -- Loads the org's drive when the route changes. */
  useEffect(() => {
    if (org && !aligned && !aligning) void syncSpace(org);
  }, [org, aligned, aligning, syncSpace]);
  // The open organization's overview (teams, members, invitations): loaded
  // per org route, refreshed when the tab returns and after org mutations.
  const [overview, setOverview] = useState<{ slug: string; data: OrgOverview } | null>(null);
  const loadOverview = useCallback(async (slug: string, current: () => boolean) => {
    const result = await getOrgOverview(slug);
    if (!current()) return;
    if (result.ok) setOverview({ slug, data: result.data });
    else toast.error(result.error);
  }, []);
  const reloadOrg = useCallback(async () => {
    if (org) await loadOverview(org, () => true);
  }, [org, loadOverview]);
  useEffect(() => {
    if (!org) return;
    let current = true;
    const load = () => void loadOverview(org, () => current);
    load();
    const refresh = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      current = false;
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [org, loadOverview]);
  // Reload when the tab returns: family and org members change the drive too.
  useEffect(() => {
    void reload();
    const refresh = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [reload]);
  /* eslint-enable react-hooks/set-state-in-effect */
  // Relock on screen once the Locked folder has been idle past its window.
  // Timed from the server's remaining ms, so client clock skew can't matter.
  const expiresIn = listing?.lockedFolder.expiresIn;
  useEffect(() => {
    if (expiresIn == null) return;
    const timer = setTimeout(() => void reload(), expiresIn + 1000);
    return () => clearTimeout(timer);
  }, [listing, expiresIn, reload]);
  const run = useCallback(
    async <T,>(pending: Promise<ActionResult<T>>, success?: string, refresh = reload) => {
      const result = await pending;
      if (!result.ok) toast.error(result.error);
      else {
        if (success) toast.success(success);
        await refresh();
      }
      return result;
    },
    [reload]
  );
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    // An explicit light/dark choice wins; otherwise follow the device.
    const apply = () => {
      const theme = readTheme();
      document.documentElement.classList.toggle(
        "dark",
        theme === "dark" || (theme !== "light" && media.matches)
      );
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  const files = useMemo(() => (listing ? toDriveFiles(listing) : []), [listing]);
  const orgOverview = org && overview?.slug === org ? overview.data : null;
  const value = useMemo(
    () => ({
      data: { ...data, files, teams: orgOverview?.teams ?? noTeams },
      organization: { overview: orgOverview, reload: reloadOrg },
      update: setData,
      loaded: loaded && listing !== null && aligned,
      user,
      drive: { listing, reload, run },
    }),
    [data, files, orgOverview, reloadOrg, loaded, listing, aligned, user, reload, run]
  );
  return <Store.Provider value={value}>{children}</Store.Provider>;
}
export function useWorkspace() {
  const context = useContext(Store);
  if (!context) throw new Error("WorkspaceProvider is required");
  return context;
}
