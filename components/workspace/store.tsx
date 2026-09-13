"use client";

import type { ActionResult, DriveListing, DriveTeam } from "@/lib/drive/types";
import type { DriveFile } from "@/lib/workspace/data";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { getDrive, switchSpace } from "@/lib/drive/items";
import { getMyInvitations, getOrgOverview, getOrganizations } from "@/lib/drive/org";
import { useWorkspaceRoute } from "./route";

// The organization the /org/[organization] route names, by slug.
function orgIdFromSlug(orgs: { slug: string; id: string }[], slug: string | null) {
  return orgs.find((o) => o.slug === slug)?.id;
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
// Only UI preferences (theme) stay on this device.
type Org = { id: string; name: string; slug: string; role: string; members: number };
type Invitation = { id: string; organization: string; expiresAt: string };
type Data = {
  files: DriveFile[];
  organizations: Org[];
  teams: DriveTeam[];
  preferences: Record<string, string | boolean>;
  invitations: Invitation[];
};
const initial: Data = {
  files: [],
  organizations: [],
  teams: [],
  preferences: {},
  invitations: [],
};
type Drive = {
  // True when the open workspace is served by the database (signed in).
  active: boolean;
  listing: DriveListing | null;
  reload: () => Promise<void>;
  // Awaits a server action, toasts its error or `success`, reloads on success.
  run: <T>(pending: Promise<ActionResult<T>>, success?: string) => Promise<ActionResult<T>>;
};
const Store = createContext<{
  data: Data;
  update: (fn: (data: Data) => Data) => void;
  loaded: boolean;
  user: { name: string; email: string };
  drive: Drive;
} | null>(null);
function toDriveFiles(listing: DriveListing): DriveFile[] {
  const provider = !listing.storage.connected
    ? "No storage connected"
    : listing.storage.provider === "r2"
      ? "Cloudflare R2"
      : "Amazon S3";
  return listing.items.map((i) => ({
    id: i.id,
    name: i.name,
    kind: i.kind,
    size: i.size,
    modified: i.updatedAt,
    owner: i.createdByName,
    ownerId: i.createdById,
    parent: i.parentId,
    workspace: "personal",
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
    remote: true,
  }));
}
export function WorkspaceProvider({
  children,
  user,
  remote = false,
}: {
  children: ReactNode;
  user: { name: string; email: string };
  remote?: boolean;
}) {
  const [data, setData] = useState<Data>(initial);
  const [loaded, setLoaded] = useState(false);
  const [listing, setListing] = useState<DriveListing | null>(null);
  const { org } = useWorkspaceRoute();
  const active = remote;
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
  const aligned = !org || listing?.workspace.id === orgIdFromSlug(data.organizations, org);
  const [aligning, setAligning] = useState(false);
  const syncSpace = useCallback(
    async (slug: string) => {
      const target = data.organizations.find((o) => o.slug === slug);
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
    if (remote && org && !aligned && !aligning) void syncSpace(org);
  }, [remote, org, aligned, aligning, syncSpace]);
  // Teams belong to the open organization route.
  useEffect(() => {
    if (!remote || !org) return;
    let cancelled = false;
    void getOrgOverview(org).then((result) => {
      if (!cancelled && result.ok)
        setData((d) => ({ ...d, teams: result.data.teams }));
      else if (!cancelled && !result.ok) toast.error(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [remote, org, loaded]);
  /* eslint-enable react-hooks/set-state-in-effect */
  // Reload when the tab returns: family and org members change the drive too.
  /* eslint-disable react-hooks/set-state-in-effect -- Loads server data after mount; state is set once the request resolves. */
  useEffect(() => {
    if (!remote) return;
    void reload();
    const refresh = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [remote, reload]);
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
    async <T,>(pending: Promise<ActionResult<T>>, success?: string) => {
      const result = await pending;
      if (!result.ok) toast.error(result.error);
      else {
        if (success) toast.success(success);
        await reload();
      }
      return result;
    },
    [reload]
  );
  const files = useMemo(
    () => (listing ? toDriveFiles(listing) : []),
    [listing]
  );
  const theme = readTheme();
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    // An explicit light/dark choice wins; otherwise follow the device.
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        theme === "dark" || (theme !== "light" && media.matches)
      );
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  return (
    <Store.Provider
      value={{
        data: { ...data, files },
        update: setData,
        loaded: loaded && (!active || (listing !== null && aligned)),
        user,
        drive: { active, listing, reload, run },
      }}
    >
      {children}
    </Store.Provider>
  );
}
export function useWorkspace() {
  const context = useContext(Store);
  if (!context) throw new Error("WorkspaceProvider is required");
  return context;
}
