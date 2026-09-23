"use client";

import { Activity, ArrowUpRight, Database, Folder, Plus, Shapes, Users } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace } from "@/components/workspace/store";
import { formatShortDate } from "@/lib/date";
import { formatSize } from "@/lib/workspace/data";
import { orgPath, useWorkspaceRoute } from "../route";
import { OrgOverviewSkeleton } from "./org-skeleton";
import { metricCard, sectionButton, useOrgData } from "./shared";
import { TeamsSection } from "./teams-page";

export function OrganizationPage() {
  const { org } = useWorkspaceRoute();
  const { drive } = useWorkspace();
  const router = useRouter();
  const { overview, load } = useOrgData();
  if (!org) return null;
  // Still arriving. A skeleton, not a bare "Organization" heading: an
  // organization with no members yet renders real, empty sections, and those
  // two states must not look alike.
  if (!overview) return <OrgOverviewSkeleton />;
  const stats = drive.listing?.storageStats;
  const files = drive.listing?.items ?? [];
  const canManage = overview.organization.role !== "member";
  return (
    <>
      <div className="mb-7.25 flex items-center justify-between gap-6 max-md:mb-5.75 max-md:items-start max-md:gap-3">
        <div>
          <div className="mb-2.5 text-[9px] tracking-[1.5px] text-muted-foreground">
            YOUR SHARED WORKSPACE
          </div>
          <h1 className="text-[29px] leading-[1.3] font-[550] tracking-[-1.2px] max-md:text-[27px]">
            {overview.organization.name}
            {!overview.organization.name.endsWith(".") && (
              <span className="text-folder-green">.</span>
            )}
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground max-md:max-w-60 max-md:text-[11px] max-md:leading-[1.6]">
            Good work starts with a connected team.
          </p>
        </div>
        {canManage && (
          <Button
            className="h-8.75 gap-1.75 px-3.25 text-[11px]"
            onClick={() => router.push(orgPath(org, "members?invite=true"))}
          >
            <Plus />
            Invite members
          </Button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-4 max-[1000px]:grid-cols-[repeat(2,1fr)]">
        {[
          {
            label: "Storage used",
            value: formatSize(stats?.usedBytes ?? 0),
            caption: stats?.usedBytes ? `Across ${stats.fileCount} files` : "No files yet",
            icon: Database,
          },
          {
            label: "Members",
            value: String(overview.members.length),
            caption: overview.invitations.length
              ? `${overview.invitations.length} invitation${overview.invitations.length === 1 ? "" : "s"} pending`
              : "Working better together",
            icon: Users,
          },
          {
            label: "Teams",
            value: String(overview.teams.length),
            caption: "A place for every project",
            icon: Shapes,
          },
          {
            label: "Files",
            value: String(files.filter((f) => !f.trashedAt).length),
            caption: "Ideas, all in one place",
            icon: Folder,
          },
        ].map((m) => (
          <Card key={m.label} className={metricCard}>
            <CardHeader>
              <CardDescription className="flex items-center justify-between text-[11px]">
                {m.label}
                <m.icon className="size-4" />
              </CardDescription>
              <CardTitle className="mt-2.25 text-[29px] leading-snug font-medium tracking-[-1px]">
                {m.value}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{m.caption}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <TeamsSection embedded org={org} overview={overview} reload={load} />
      <section className="mt-8.5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2.25 text-[13px] font-[550] md:text-[14px]">
            Workspace activity
          </h2>
          <Button
            variant="ghost"
            className={sectionButton}
            onClick={() => router.push(orgPath(org, "settings?section=audit"))}
          >
            View audit log
            <ArrowUpRight />
          </Button>
        </div>
        {overview.members.slice(0, 5).map((m) => (
          <div className="flex items-center gap-3.25 border-b py-4.25" key={m.id}>
            <span className="grid size-8 place-items-center rounded-full bg-muted">
              <Activity className="size-3.5 text-primary" />
            </span>
            <div>
              <strong className="text-[12px] font-medium">{m.name}</strong>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {m.role === "owner" ? "owns this workspace" : `joined as ${m.role}`}
                {m.userId === drive.listing?.workspace.userId ? " · you" : ""}
              </p>
            </div>
            <small className="ml-auto text-[10px] text-muted-foreground">
              {formatShortDate(m.joinedAt)}
            </small>
          </div>
        ))}
      </section>
    </>
  );
}
