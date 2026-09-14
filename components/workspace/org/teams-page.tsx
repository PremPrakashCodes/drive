"use client";

import type { DriveTeam, OrgOverview } from "@/types";
import { ArrowUpRight, Folder, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useWorkspace } from "@/components/workspace/store";
import { removeTeamAction } from "@/lib/drive/teams";
import { cn } from "@/lib/utils";
import { formatSize } from "@/lib/workspace/data";
import { EmptyState, PersonAvatar } from "../common";
import { orgPath, useWorkspaceRoute } from "../route";
import { CreateTeamButton } from "./create-team-dialog";
import {
  emblemColor,
  introAvatarTint,
  pageHeadingClass,
  pageTitleClass,
  sectionButton,
  teamIcon,
  useOrgData,
} from "./shared";

export function TeamsPage({ inSettings }: { inSettings?: boolean } = {}) {
  const { org } = useWorkspaceRoute();
  const { overview, load } = useOrgData();
  if (!org) return null;
  if (!overview)
    return (
      <div className={pageHeadingClass(inSettings)}>
        <h1 className={pageTitleClass(inSettings)}>Teams</h1>
      </div>
    );
  return <TeamsSection org={org} overview={overview} reload={load} inSettings={inSettings} />;
}

export function TeamsSection({
  org,
  overview,
  reload,
  embedded = false,
  inSettings,
}: {
  org: string;
  overview: OrgOverview;
  reload: () => Promise<void>;
  embedded?: boolean;
  inSettings?: boolean;
}) {
  const router = useRouter();
  const { drive } = useWorkspace();
  const canManage = overview.organization.role !== "member";
  const [remove, setRemove] = useState<DriveTeam | null>(null);
  const { teams } = overview;
  return (
    <>
      <div
        className={
          embedded
            ? "mt-9 mb-4 flex items-center justify-between gap-4"
            : pageHeadingClass(inSettings)
        }
      >
        <div>
          {embedded ? (
            <h2 className="flex items-center gap-2.25 text-[13px] font-[550] md:text-[14px]">
              Your teams
            </h2>
          ) : (
            <>
              <h1 className={pageTitleClass(inSettings)}>
                Teams{!inSettings && <span className="text-folder-green">.</span>}
              </h1>
              <p className="mt-2 text-[13px] text-muted-foreground max-md:max-w-60 max-md:text-[11px] max-md:leading-[1.6]">
                A shared home for every kind of work.
              </p>
            </>
          )}
        </div>
        {canManage && (
          <Button
            variant={embedded ? "ghost" : "default"}
            className={embedded ? sectionButton : "h-8.75 gap-1.75 px-3.25 text-[11px]"}
            onClick={() => reload()}
          >
            Refresh
          </Button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-4.5 max-[1200px]:gap-3 max-[1000px]:grid-cols-[1fr]">
        {teams.map((t, i) => {
          const Icon = teamIcon[i % 3];
          return (
            <Card key={t.id} className="shadow-none ring-0">
              <CardHeader>
                <div
                  className={cn(
                    "mb-4 grid size-9.5 place-items-center rounded-[9px]",
                    emblemColor[t.color ?? "green"] ?? emblemColor.green
                  )}
                >
                  <Icon className="size-5" />
                </div>
                <CardTitle>
                  <button
                    className="flex w-full items-center justify-between text-[15px]"
                    onClick={() => router.push(orgPath(org, `teams/${t.id}`))}
                  >
                    {t.name}
                    <ArrowUpRight className="size-4" />
                  </button>
                </CardTitle>
                <CardDescription className="min-h-9.5 text-[11px] leading-[1.7]">
                  {t.description || "A team workspace."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3 text-[9px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="size-3" />
                    {t.memberCount} member{t.memberCount === 1 ? "" : "s"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Folder className="size-3" />
                    {formatSize(0)}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="justify-between max-[1200px]:flex-wrap max-[1200px]:gap-2.5">
                <span className="inline-flex pl-1.75">
                  {overview.members
                    .filter((m) => m.teams?.includes(t.id))
                    .slice(0, 3)
                    .map((m, index) => (
                      <PersonAvatar
                        key={m.id}
                        name={m.name}
                        className={cn(
                          "-ml-1.75 size-6.25! border-2 border-sidebar",
                          introAvatarTint[index]
                        )}
                      />
                    ))}
                </span>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[10px]"
                    onClick={() => setRemove(t)}
                  >
                    <X />
                    Remove
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
      {!teams.length && (
        <EmptyState
          title="No teams yet"
          description="Create your first team to organize collaboration."
        >
          {canManage && <CreateTeamButton org={org} reload={reload} />}
        </EmptyState>
      )}
      <AlertDialog
        open={!!remove}
        onOpenChange={(o) => {
          if (!o) setRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove “{remove?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Members stay in the organization; only the team goes away.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (remove)
                  void drive.run(removeTeamAction(org, remove.id), "Team removed", reload);
                setRemove(null);
              }}
            >
              Remove team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
