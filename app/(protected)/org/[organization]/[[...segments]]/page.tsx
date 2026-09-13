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
  params: Promise<{ organization: string; segments?: string[] }>;
}) {
  const { segments = [] } = await params;
  const [page] = segments;
  if (!page) return <OrganizationPage />;
  if (page === "settings") return <SettingsPage />;
  if (page === "storage") return <StoragePage />;
  if (page === "members") return <MembersPage />;
  if (page === "teams") return segments[1] ? <TeamWorkspace /> : <TeamsPage />;
  if (["drive", "recent", "starred", "shared", "trash"].includes(page))
    return <FileBrowser />;
  notFound();
}
