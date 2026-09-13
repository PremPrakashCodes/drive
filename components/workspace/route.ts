"use client";
import { usePathname } from "next/navigation";
export function useWorkspaceRoute() {
  const path = usePathname();
  const parts = path.split("/").filter(Boolean);
  const demo = parts[0] === "demo";
  if (demo) parts.shift();
  const prefix = demo ? "/demo" : "";
  const org = parts[0] === "org" ? parts[1] : null;
  const page = org ? parts[2] || "overview" : parts[0] || "drive";
  return {
    org,
    workspace: org || "personal",
    page,
    team: org && page === "teams" ? parts[3] : undefined,
    base: org ? `${prefix}/org/${org}` : prefix,
    path,
    prefix,
    demo,
  };
}
