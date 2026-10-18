"use client";

import type { ActionResult, DriveListing, WorkspaceData } from "@/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useRefreshOnVisible } from "@/hooks/use-refresh-on-visible";
import { getWorkspaceSnapshot } from "@/lib/drive/workspace-snapshot";
import { createFreshness } from "@/lib/workspace/freshness";
import { isSessionExpired, signInPath } from "@/lib/workspace/session";

const initial: WorkspaceData = { organizations: [], invitations: [] };

export function useWorkspaceData() {
  const [data, setData] = useState<WorkspaceData>(initial);
  const [loaded, setLoaded] = useState(false);
  const [listing, setListing] = useState<DriveListing | null>(null);
  const router = useRouter();
  // Reloads overlap constantly (mount, the tab returning, the relock timer,
  // every mutation), so each one claims a generation and only the newest is
  // allowed to write. `useState` with the factory, not `useRef`: one instance
  // for the life of the provider, created without touching a ref in render.
  const [freshness] = useState(createFreshness);
  const reload = useCallback(async () => {
    const generation = freshness.begin();
    const result = await getWorkspaceSnapshot();
    // Overtaken while in flight: this answer is older than what is on screen.
    if (!freshness.isCurrent(generation)) return;
    if (!result.ok) {
      if (isSessionExpired(result)) router.replace(signInPath(window.location));
      else toast.error(`Your workspace didn't refresh. ${result.error}`, { id: "reload-drive" });
      return;
    }
    const {
      drive: driveResult,
      organizations: orgsResult,
      invitations: invitesResult,
    } = result.data;
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
  useRefreshOnVisible(reload, freshness.cancel);
  // Relock on screen once the Locked folder has been idle past its window.
  // Timed from the server's remaining ms, so client clock skew can't matter.
  const expiresIn = listing?.lockedFolder.expiresIn;
  useEffect(() => {
    if (expiresIn == null) return;
    const timer = setTimeout(() => void reload(), expiresIn + 1000);
    return () => clearTimeout(timer);
  }, [listing, expiresIn, reload]);
  const run = useCallback(
    async <T>(pending: Promise<ActionResult<T>>, success?: string, refresh = reload) => {
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
  return { data, loaded, listing, reload, run };
}
