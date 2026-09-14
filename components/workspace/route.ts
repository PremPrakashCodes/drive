"use client";

import { usePathname } from "next/navigation";

// An organization page's URL: /org/<slug>/<page>.
export const orgPath = (slug: string, page = "drive") => `/org/${slug}/${page}`;

export function useWorkspaceRoute() {
  const parts = usePathname().split("/").filter(Boolean);
  const org = parts[0] === "org" ? parts[1] : null;
  const page = org ? parts[2] || "overview" : parts[0] || "drive";
  return {
    org,
    workspace: org || "personal",
    page,
    team: org && page === "teams" ? parts[3] : undefined,
    base: org ? `/org/${org}` : "",
  };
}
