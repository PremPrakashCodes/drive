"use client";

import type { DriveMember, Invitee } from "@/types";
import { Mail, MoreHorizontal, Plus, Search } from "lucide-react";
import { useQueryState } from "nuqs";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useWorkspace } from "@/components/workspace/store";
import { useActionGuard } from "@/hooks/use-action-guard";
import { formatMediumDate, formatShortDate } from "@/lib/date";
import { cancelOrgInvitation, updateOrgMemberRole } from "@/lib/drive/org";
import { Choice, EmptyState, PersonAvatar } from "../common";
import { useWorkspaceRoute } from "../route";
import { InviteMembersDialog, RemoveMemberDialog } from "./member-dialogs";
import { pageHeadingClass, pageTitleClass, useOrgData } from "./shared";

export function MembersPage({
  teamOnly,
  inSettings,
}: { teamOnly?: string; inSettings?: boolean } = {}) {
  const { org } = useWorkspaceRoute();
  const { overview, load } = useOrgData();
  const { drive } = useWorkspace();
  const [search, setSearch] = useQueryState("search", { defaultValue: "" });
  const [status, setStatus] = useQueryState("status", { defaultValue: "all" });
  const [, setInvite] = useQueryState("invite");
  const [remove, setRemove] = useState<DriveMember | null>(null);
  if (!org) return null;
  if (!overview)
    return (
      <div className={pageHeadingClass(inSettings)}>
        <h1 className={pageTitleClass(inSettings)}>Members</h1>
      </div>
    );
  const canManage = overview.organization.role !== "member";
  const teamName = (id: string | null) => overview.teams.find((t) => t.id === id)?.name;
  // Members, with pending invitations folded in as "Invited" rows.
  const invited: Invitee[] = overview.invitations.map((i) => ({ ...i, kind: "invitation" }));
  const rows: Invitee[] = [
    ...overview.members.map((m) => ({ ...m, kind: "member" as const })),
    ...(status === "all" || status === "Invited" ? invited : []),
  ].filter(
    (r) =>
      (status === "all" ||
        (status === "Invited" ? r.kind === "invitation" : r.kind === "member")) &&
      `${r.kind === "member" ? r.name : ""} ${r.email}`.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <>
      <div className={pageHeadingClass(inSettings)}>
        <div>
          <h1 className={pageTitleClass(inSettings)}>
            Members{!inSettings && <span className="text-folder-green">.</span>}
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground max-md:max-w-60 max-md:text-[11px] max-md:leading-[1.6]">
            The people who make it all happen.
          </p>
        </div>
        {canManage && (
          <Button
            className="h-8.75 gap-1.75 px-3.25 text-[11px]"
            onClick={() => void setInvite("true")}
          >
            <Plus />
            Invite members
          </Button>
        )}
      </div>
      <div className="mb-6.25 flex items-center gap-2.5 border-b pb-5.75 max-[1000px]:gap-1.75 max-md:mb-5.5 max-md:flex-wrap max-md:gap-y-3 max-md:pb-4.5">
        <div className="flex w-63.75 items-center gap-2 rounded-[7px] border bg-background pl-2.75 text-muted-foreground focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring max-[1000px]:w-52.5 max-md:w-[calc(100%-85px)]">
          <Search className="size-4" />
          <Input
            className="h-8.25 rounded-[7px] border-0 bg-transparent py-2 pr-2 pl-0 text-[11px] shadow-none focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline-none md:text-[12px] dark:bg-transparent"
            aria-label="Search members"
            placeholder="Search members…"
            value={search}
            onChange={(e) => void setSearch(e.target.value)}
          />
        </div>
        <Choice
          label="Member status"
          className="max-md:min-h-9"
          value={status}
          onChange={setStatus}
          options={[{ label: "All statuses", value: "all" }, "Active", "Invited"]}
        />
        <span className="ml-auto text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? "person" : "people"}
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {["Member", "Role", "Team", "Status", "Joined", ""].map((s, i) => (
              <TableHead key={i} className="text-[11px] text-muted-foreground">
                {s}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const isInvite = row.kind === "invitation";
            const member = row.kind === "member" ? row : null;
            const displayName = member ? member.name : row.email.split("@")[0];
            const teamLabel = isInvite
              ? (teamName(row.teamId) ?? "—")
              : (overview.teams.find((t) => member?.teams.includes(t.id))?.name ?? "—");
            return (
              <TableRow key={row.id}>
                <TableCell className="text-[12px]">
                  <div className="flex items-center gap-2.5 py-1 text-[12px]">
                    <PersonAvatar name={displayName} />
                    <div className="flex flex-col gap-0.75">
                      <strong className="font-medium">{displayName}</strong>
                      <small className="text-[10px] text-muted-foreground">{row.email}</small>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-[12px]">
                  {row.role === "owner" ? (
                    "Owner"
                  ) : isInvite ? (
                    <span className="text-muted-foreground capitalize">{row.role}</span>
                  ) : canManage ? (
                    <MemberRoleChoice
                      org={org}
                      memberId={row.id}
                      name={displayName}
                      role={row.role}
                      reload={load}
                    />
                  ) : (
                    <span className="capitalize">{row.role}</span>
                  )}
                </TableCell>
                <TableCell className="text-[12px]">{teamLabel}</TableCell>
                <TableCell className="text-[12px]">
                  <Badge variant={isInvite ? "outline" : "secondary"}>
                    {isInvite ? "Invited" : "Active"}
                  </Badge>
                </TableCell>
                <TableCell className="text-[12px] text-muted-foreground">
                  {isInvite
                    ? `Expires ${formatShortDate(row.expiresAt)}`
                    : formatMediumDate(row.joinedAt)}
                </TableCell>
                <TableCell className="text-[12px]">
                  {canManage && row.role !== "owner" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for ${displayName}`}
                          />
                        }
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuGroup>
                          {isInvite ? (
                            <DropdownMenuItem
                              onClick={() =>
                                void drive.run(
                                  cancelOrgInvitation(org, row.id),
                                  "Invitation cancelled",
                                  load
                                )
                              }
                            >
                              <Mail />
                              Cancel invitation
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => member && setRemove(member)}
                            >
                              Remove member
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {!rows.length && (
        <EmptyState
          title="No members found"
          description="Try another name, email address, or status."
        />
      )}
      <InviteMembersDialog org={org} teams={overview.teams} teamOnly={teamOnly} reload={load} />
      <RemoveMemberDialog org={org} member={remove} onClose={() => setRemove(null)} reload={load} />
    </>
  );
}

// One member's role select. Its own component so each row keeps its own
// in-flight state: the select is disabled until the change lands, rather than
// snapping back to the old role while the request is still going.
function MemberRoleChoice({
  org,
  memberId,
  name,
  role,
  reload,
}: {
  org: string;
  memberId: string;
  name: string;
  role: string;
  reload: () => Promise<void>;
}) {
  const { drive } = useWorkspace();
  const guard = useActionGuard();
  return (
    <Choice
      label={`Role for ${name}`}
      value={role === "admin" ? "Admin" : "Member"}
      disabled={guard.pending}
      onChange={(newRole) =>
        void guard.run(() =>
          drive.run(
            updateOrgMemberRole(org, memberId, newRole.toLowerCase()),
            "Role updated",
            reload
          )
        )
      }
      options={["Admin", "Member"]}
    />
  );
}
