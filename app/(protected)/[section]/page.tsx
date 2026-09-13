import { notFound } from "next/navigation";
import { FileBrowser } from "@/components/files/file-browser";
import { LockedFolder } from "@/components/files/locked-folder";
import { SettingsPage } from "@/components/settings/settings-page";
import { StoragePage } from "@/components/workspace/storage-page";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (section === "settings") return <SettingsPage />;
  if (section === "storage") return <StoragePage />;
  if (section === "locked") return <LockedFolder />;
  if (["drive", "recent", "starred", "shared", "trash"].includes(section))
    return <FileBrowser />;
  notFound();
}
