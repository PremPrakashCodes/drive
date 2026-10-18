"use client";

import type { OrgOverview } from "@/types";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { useRefreshOnVisible } from "@/hooks/use-refresh-on-visible";
import { getOrgOverview } from "@/lib/drive/org";
import { createFreshness } from "@/lib/workspace/freshness";
import { isSessionExpired, signInPath } from "@/lib/workspace/session";

export function useOrganizationOverview(org: string | null) {
  const router = useRouter();
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
  useRefreshOnVisible(reloadOrg, orgFreshness.cancel);
  const current = org && overview?.slug === org ? overview.data : null;
  return useMemo(() => ({ overview: current, reload: reloadOrg }), [current, reloadOrg]);
}
