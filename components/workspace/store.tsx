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
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { getDrive } from "@/lib/drive/drive-listing";
import { switchSpace } from "@/lib/drive/items";
import { getMyInvitations, getOrgOverview, getOrganizations } from "@/lib/drive/org";
import { createFreshness } from "@/lib/workspace/freshness";
import { activeStorage } from "@/lib/workspace/providers";
import { isSessionExpired, signInPath } from "@/lib/workspace/session";
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
const noTeams: DriveTeam[] = [];
const initial: WorkspaceData = {
  organizations: [],
  invitations: [],
};
const Store = createContext<{
  data: WorkspaceData & { files: DriveFile[]; teams: DriveTeam[] };
  // The open org route's overview, shared by the sidebar and the org pages.
  organization: { overview: OrgOverview | null; reload: () => Promise<void> };
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
  const router = useRouter();
  // Reloads overlap constantly (mount, the tab returning, the relock timer,
  // every mutation), so each one claims a generation and only the newest is
  // allowed to write. `useState` with the factory, not `useRef`: one instance
  // for the life of the provider, created without touching a ref in render.
  const [freshness] = useState(createFreshness);
  const reload = useCallback(async () => {
    const generation = freshness.begin();
    const [driveResult, orgsResult, invitesResult] = await Promise.all([
      getDrive(),
      getOrganizations(),
      getMyInvitations(),
    ]);
    // Overtaken while in flight: this answer is older than what is on screen.
    if (!freshness.isCurrent(generation)) return;
    // A session that ran out fails all three the same way, and will fail the
    // next reload too — this one runs again every time the tab is looked at.
    // Route once instead of stacking a toast per visit (same as `run`).
    if ([driveResult, orgsResult, invitesResult].some(isSessionExpired)) {
      router.replace(signInPath(window.location));
      return;
    }
    // Each loader answers for itself, under its own toast id: a tab that
    // comes back to a server still refusing replaces the message instead of
    // piling up copies of it, and the message names what did not load.
    if (driveResult.ok) setListing(driveResult.data);
    else toast.error(`Your files didn't refresh. ${driveResult.error}`, { id: "reload-drive" });
    if (orgsResult.ok) setData((d) => ({ ...d, organizations: orgsResult.data }));
    else toast.error(`Your organizations didn't load. ${orgsResult.error}`, { id: "reload-orgs" });
    if (invitesResult.ok) setData((d) => ({ ...d, invitations: invitesResult.data }));
    else
      toast.error(`Your invitations didn't load. ${invitesResult.error}`, {
        id: "reload-invitations",
      });
    // Mark hydration done once the first load settles, whatever it returned.
    setLoaded(true);
  }, [freshness, router]);
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
      // An expired session is the reload's to report: it routes to sign-in,
      // and a toast here would only say the same thing in worse words.
      if (!result.ok && !isSessionExpired(result)) toast.error(result.error);
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
  // The overview keeps its own generations: refreshing the drive listing must
  // not discard an overview still on its way, and the other way round.
  const [orgFreshness] = useState(createFreshness);
  const loadOverview = useCallback(
    async (slug: string) => {
      const generation = orgFreshness.begin();
      const result = await getOrgOverview(slug);
      if (!orgFreshness.isCurrent(generation)) return;
      if (result.ok) setOverview({ slug, data: result.data });
      else if (isSessionExpired(result)) router.replace(signInPath(window.location));
      else
        toast.error(`This organization didn't load. ${result.error}`, {
          id: "reload-organization",
        });
    },
    [orgFreshness, router]
  );
  const reloadOrg = useCallback(async () => {
    if (org) await loadOverview(org);
  }, [org, loadOverview]);
  useEffect(() => {
    if (!org) return;
    const load = () => void loadOverview(org);
    load();
    const refresh = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      // Leaving this org: whatever is still in flight answers for a page the
      // person is no longer on.
      orgFreshness.cancel();
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [org, loadOverview, orgFreshness]);
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
      if (!result.ok) {
        // A session that ran out isn't something to try again: every later
        // action fails the same way, so the toast would repeat until the tab
        // is closed. Send them to sign in instead, carrying where they were
        // so they land back on this page. `replace`, because the page behind
        // us can no longer load anything.
        if (isSessionExpired(result)) router.replace(signInPath(window.location));
        else toast.error(result.error);
      } else {
        if (success) toast.success(success);
        await refresh();
      }
      return result;
    },
    [reload, router]
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
