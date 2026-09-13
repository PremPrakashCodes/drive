"use client";

import { useQueryState } from "nuqs";

import { FileBrowser } from "@/components/files/file-browser";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MembersPage } from "./organization-pages";
import { useWorkspaceRoute } from "./route";

export function TeamWorkspace() {
  const [tab, setTab] = useQueryState("tab", {
    defaultValue: "files",
    history: "push",
  });
  const { team } = useWorkspaceRoute();
  return (
    <>
      <Tabs value={tab} onValueChange={(v) => void setTab(String(v))} className="mb-6">
        <TabsList>
          <TabsTrigger value="files">Team files</TabsTrigger>
          <TabsTrigger value="members">Team members</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "members" ? <MembersPage teamOnly={team} /> : <FileBrowser />}
    </>
  );
}
