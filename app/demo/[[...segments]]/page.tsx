import { TeamWorkspace } from "@/components/workspace/team-workspace";
import { notFound } from "next/navigation";
import { FileBrowser } from "@/components/files/file-browser";
import { SettingsPage } from "@/components/settings/settings-page";
import { StoragePage } from "@/components/workspace/storage-page";
import {
  OrganizationPage,
  TeamsPage,
  MembersPage,
} from "@/components/workspace/organization-pages";
export default async function Page({
  params,
}: {
  params: Promise<{ segments?: string[] }>;
}) {
  const { segments = [] } = await params;
  const org = segments[0] === "org";
  const page = org ? segments[2] : segments[0];
  if (org && !page) return <OrganizationPage />;
  if (page === "settings") return <SettingsPage />;
  if (page === "storage") return <StoragePage />;
  if (page === "members" && org) return <MembersPage />;
  if (page === "teams" && org)
    return segments[3] ? <TeamWorkspace /> : <TeamsPage />;
  if (!page || ["drive", "recent", "starred", "shared", "trash"].includes(page))
    return <FileBrowser />;
  notFound();
}
