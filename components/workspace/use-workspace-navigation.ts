"use client";

import type { ActionResult, WorkspaceDestination, WorkspaceNavigationOptions } from "@/types";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { switchSpace } from "@/lib/drive/items";
import { getWorkspaceAlignment, workspaceDestinationReady } from "@/lib/workspace/navigation";
import { isSessionExpired } from "@/lib/workspace/session";
import { useWorkspaceRoute } from "./route";

export function useWorkspaceNavigation({
  organizations,
  listing,
  reload,
  run,
}: WorkspaceNavigationOptions) {
  const { org } = useWorkspaceRoute();
  const pathname = usePathname();
  const router = useRouter();
  const [destination, setDestination] = useState<WorkspaceDestination | null>(null);
  const manualSwitch = useRef(false);
  const lastPersonalWorkspace = useRef<string | null>(null);
  const [aligning, setAligning] = useState(false);
  const { aligned } = getWorkspaceAlignment({ org, organizations, listing });

  useEffect(() => {
    if (listing?.workspace.kind === "personal")
      lastPersonalWorkspace.current = listing.workspace.id;
  }, [listing]);

  const navigateWorkspace = useCallback(
    async (id: string, nextPathname: string): Promise<ActionResult> => {
      if (manualSwitch.current)
        return { ok: false, error: "A workspace switch is already in progress." };
      manualSwitch.current = true;
      setDestination({ id, pathname: nextPathname });
      try {
        // Do not refresh under the old route: its alignment effect would switch
        // the cookie straight back to the organization we are leaving.
        const result = await run(switchSpace(id), undefined, async () => {});
        if (!result.ok) {
          manualSwitch.current = false;
          setDestination(null);
          return result;
        }
        router.push(nextPathname);
        await reload();
        return result;
      } catch (error) {
        manualSwitch.current = false;
        setDestination(null);
        throw error;
      }
    },
    [reload, router, run]
  );

  const syncSpace = useCallback(
    async (id: string) => {
      if (listing?.workspace.id === id || manualSwitch.current) return;
      setAligning(true);
      try {
        const result = await switchSpace(id);
        if (!result.ok && !isSessionExpired(result)) toast.error(result.error);
        await reload();
      } finally {
        setAligning(false);
      }
    },
    [listing, reload]
  );

  /* eslint-disable react-hooks/set-state-in-effect -- Settles explicit navigation or aligns a directly opened organization route. */
  useEffect(() => {
    if (destination) {
      // Keep automatic alignment paused until BOTH the route and its listing
      // have arrived; either can finish first. File views stay in loading UI.
      if (workspaceDestinationReady(destination, pathname, listing?.workspace.id)) {
        manualSwitch.current = false;
        setDestination(null);
      }
      return;
    }
    // Back/Forward and direct links also need alignment. A personal route may
    // retain a family drive, but must never show an organization's listing.
    const { targetId } = getWorkspaceAlignment({
      org,
      organizations,
      listing,
      lastPersonalId: lastPersonalWorkspace.current,
    });
    if (targetId && !aligned && !aligning) void syncSpace(targetId);
  }, [destination, pathname, listing, organizations, org, aligned, aligning, syncSpace]);
  /* eslint-enable react-hooks/set-state-in-effect */
  return { aligned, switching: destination !== null, navigateWorkspace };
}
