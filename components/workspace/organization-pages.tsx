"use client";

import type { DriveInvitation, DriveMember, DriveOrganization, DriveTeam } from "@/lib/drive/types";
import {
  Activity,
  ArrowUpRight,
  CalendarPlus,
  Database,
  Folder,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  Shapes,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/components/workspace/store";
import { formatMediumDate, formatShortDate } from "@/lib/date";
import {
  cancelOrgInvitation,
  createTeamAction,
  getOrgOverview,
  inviteMembers,
  removeOrgMember,
  removeTeamAction,
  updateOrgMemberRole,
} from "@/lib/drive/org";
import { cn } from "@/lib/utils";
import { Choice, EmptyState, PersonAvatar } from "./common";
import { useWorkspaceRoute } from "./route";

type Overview = {
  organization: DriveOrganization;
  teams: DriveTeam[];
  members: DriveMember[];
  invitations: DriveInvitation[];
};

// Server data for the open organization, reloaded after each mutation.
function useOrgData(slug: string) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const load = useCallback(async () => {
    const result = await getOrgOverview(slug);
    if (result.ok) setOverview(result.data);
    else toast.error(result.error);
  }, [slug]);
  /* eslint-disable react-hooks/set-state-in-effect -- Loads server data after mount; state is set once the request resolves. */
  useEffect(() => {
    void load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */
  return { overview, load };
}

const teamIcon = [CalendarPlus, Shapes, Users];
// Team colors come from data; blue has no emblem style of its own and keeps the default look.
const emblemColor: Record<string, string> = {
  green: "bg-surface-green text-primary",
  purple: "bg-surface-purple text-folder-purple",
  amber: "bg-surface-amber text-folder-amber",
  blue: "bg-surface-green text-primary",
};
// Second and third stacked avatars get their own tint.
const introAvatarTint = [
  "",
  "[&_[data-slot=avatar-fallback]]:bg-surface-purple! [&_[data-slot=avatar-fallback]]:text-folder-purple!",
  "[&_[data-slot=avatar-fallback]]:bg-surface-blue! [&_[data-slot=avatar-fallback]]:text-folder-blue!",
];
const metricCard = "shadow-none ring-0";
const sectionButton =
  "flex items-center gap-[7px] text-[10px] text-muted-foreground hover:text-muted-foreground md:text-[11px]";

export function OrganizationPage() {
  const { org } = useWorkspaceRoute();
  const { drive } = useWorkspace();
  const router = useRouter();
  const { overview } = useOrgData(org ?? "");
  if (!org) return null;
  if (!overview)
    return (
      <div className="mb-[29px] flex items-center justify-between gap-6 max-md:mb-[23px] max-md:items-start max-md:gap-3">
        <div>
          <h1 className="text-[29px] leading-[1.3] font-[550] tracking-[-1.2px] max-md:text-[27px]">
            Organization
          </h1>
        </div>
      </div>
    );
  const stats = drive.listing?.storageStats;
  const files = drive.listing?.items ?? [];
  const canManage = overview.organization.role !== "member";
  return (
    <>
      <div className="mb-[29px] flex items-center justify-between gap-6 max-md:mb-[23px] max-md:items-start max-md:gap-3">
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
          <p className="mt-2 text-[13px] text-muted-foreground max-md:max-w-[240px] max-md:text-[11px] max-md:leading-[1.6]">
            Good work starts with a connected team.
          </p>
        </div>
        {canManage && (
          <Button
            className="h-[35px] gap-[7px] px-[13px] text-[11px]"
            onClick={() => router.push(`/org/${org}/members?invite=true`)}
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
            value: formatBytes(stats?.usedBytes ?? 0),
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
              <CardTitle className="mt-[9px] text-[29px] leading-snug font-medium tracking-[-1px]">
                {m.value}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{m.caption}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <TeamsSection embedded org={org} overview={overview} reload={async () => {}} />
      <section className="mt-[34px]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-[9px] text-[13px] font-[550] md:text-[14px]">
            Workspace activity
          </h2>
          <Button
            variant="ghost"
            className={sectionButton}
            onClick={() => router.push(`/org/${org}/settings?section=audit`)}
          >
            View audit log
            <ArrowUpRight />
          </Button>
        </div>
        {overview.members.slice(0, 5).map((m) => (
          <div className="flex items-center gap-[13px] border-b py-[17px]" key={m.id}>
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
const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1000)), units.length - 1);
  return `${(bytes / 1000 ** power).toFixed(power ? 1 : 0)} ${units[power]}`;
};

// Members and Teams also render inside settings, where the page title is smaller.
const pageHeadingClass = (inSettings?: boolean) =>
  inSettings
    ? "mb-5 flex items-center justify-between gap-6 max-md:flex-wrap max-md:items-start max-md:gap-3"
    : "mb-[29px] flex items-center justify-between gap-6 max-md:mb-[23px] max-md:items-start max-md:gap-3";
const pageTitleClass = (inSettings?: boolean) =>
  inSettings
    ? "text-[19px] leading-[1.3] font-medium tracking-[-0.4px]"
    : "text-[29px] leading-[1.3] font-[550] tracking-[-1.2px] max-md:text-[27px]";

export function TeamsPage({ inSettings }: { inSettings?: boolean } = {}) {
  const { org } = useWorkspaceRoute();
  const { overview, load } = useOrgData(org ?? "");
  const [open, setOpen] = useState(false);
  if (!org) return null;
  if (!overview)
    return (
      <div className={pageHeadingClass(inSettings)}>
        <h1 className={pageTitleClass(inSettings)}>Teams</h1>
      </div>
    );
  return (
    <>
      <TeamsSection org={org} overview={overview} reload={load} inSettings={inSettings} />
      <CreateTeamDialog org={org} open={open} onOpenChange={setOpen} reload={load} />
    </>
  );
}

function TeamsSection({
  org,
  overview,
  reload,
  embedded = false,
  inSettings,
}: {
  org: string;
  overview: Overview;
  reload: () => Promise<void>;
  embedded?: boolean;
  inSettings?: boolean;
}) {
  const router = useRouter();
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
            <h2 className="flex items-center gap-[9px] text-[13px] font-[550] md:text-[14px]">
              Your teams
            </h2>
          ) : (
            <>
              <h1 className={pageTitleClass(inSettings)}>
                Teams{!inSettings && <span className="text-folder-green">.</span>}
              </h1>
              <p className="mt-2 text-[13px] text-muted-foreground max-md:max-w-[240px] max-md:text-[11px] max-md:leading-[1.6]">
                A shared home for every kind of work.
              </p>
            </>
          )}
        </div>
        {canManage && (
          <Button
            variant={embedded ? "ghost" : "default"}
            className={embedded ? sectionButton : "h-[35px] gap-[7px] px-[13px] text-[11px]"}
            onClick={() => reload()}
          >
            Refresh
          </Button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-[18px] max-[1200px]:gap-3 max-[1000px]:grid-cols-[1fr]">
        {teams.map((t, i) => {
          const Icon = teamIcon[i % 3];
          return (
            <Card key={t.id} className="shadow-none ring-0">
              <CardHeader>
                <div
                  className={cn(
                    "mb-4 grid size-[38px] place-items-center rounded-[9px]",
                    emblemColor[t.color ?? "green"] ?? emblemColor.green
                  )}
                >
                  <Icon className="size-5" />
                </div>
                <CardTitle>
                  <button
                    className="flex w-full items-center justify-between text-[15px]"
                    onClick={() => router.push(`/org/${org}/teams/${t.id}`)}
                  >
                    {t.name}
                    <ArrowUpRight className="size-4" />
                  </button>
                </CardTitle>
                <CardDescription className="min-h-[38px] text-[11px] leading-[1.7]">
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
                    {formatBytes(0)}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="justify-between max-[1200px]:flex-wrap max-[1200px]:gap-2.5">
                <span className="inline-flex pl-[7px]">
                  {overview.members
                    .filter((m) => m.teams?.includes(t.id))
                    .slice(0, 3)
                    .map((m, index) => (
                      <PersonAvatar
                        key={m.id}
                        name={m.name}
                        className={cn(
                          "-ml-[7px] size-[25px]! border-2 border-sidebar",
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
                  void runAction(removeTeamAction(org, remove.id), "Team removed", reload);
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

function CreateTeamButton({ org, reload }: { org: string; reload: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Create team
      </Button>
      <CreateTeamDialog org={org} open={open} onOpenChange={setOpen} reload={reload} />
    </>
  );
}

function CreateTeamDialog({
  org,
  open,
  onOpenChange,
  reload,
}: {
  org: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reload: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("green");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a team</DialogTitle>
          <DialogDescription>Make room for your next collaboration.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            try {
              const result = await createTeamAction(org, { name, description, color });
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              await reload();
              onOpenChange(false);
              setName("");
              setDescription("");
              toast.success("Team created");
            } finally {
              setBusy(false);
            }
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="team-name">Team name</FieldLabel>
              <Input
                id="team-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                placeholder="Engineering"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="team-description">Description</FieldLabel>
              <Textarea
                id="team-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What brings this team together?"
              />
            </Field>
            <Field>
              <FieldLabel>Team color</FieldLabel>
              <Choice
                label="Team color"
                value={color}
                onChange={setColor}
                options={["green", "purple", "amber", "blue"]}
              />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create team"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

async function runAction(
  pending: Promise<{ ok: boolean; error?: string }>,
  success: string,
  reload: () => Promise<void>
) {
  const result = await pending;
  if (!result.ok) {
    toast.error(result.error ?? "Something went wrong");
    return false;
  }
  toast.success(success);
  await reload();
  return true;
}

// A member row, or a pending invitation shown as "Invited".
type Invitee = (DriveMember & { kind: "member" }) | (DriveInvitation & { kind: "invitation" });

export function MembersPage({
  teamOnly,
  inSettings,
}: { teamOnly?: string; inSettings?: boolean } = {}) {
  const { org } = useWorkspaceRoute();
  const { overview, load } = useOrgData(org ?? "");
  const [search, setSearch] = useQueryState("search", { defaultValue: "" });
  const [status, setStatus] = useQueryState("status", { defaultValue: "all" });
  const [invite, setInvite] = useQueryState("invite");
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState("member");
  const [team, setTeam] = useState(teamOnly ?? "");
  const [remove, setRemove] = useState<DriveMember | null>(null);
  const [busy, setBusy] = useState(false);
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
          <p className="mt-2 text-[13px] text-muted-foreground max-md:max-w-[240px] max-md:text-[11px] max-md:leading-[1.6]">
            The people who make it all happen.
          </p>
        </div>
        {canManage && (
          <Button
            className="h-[35px] gap-[7px] px-[13px] text-[11px]"
            onClick={() => void setInvite("true")}
          >
            <Plus />
            Invite members
          </Button>
        )}
      </div>
      <div className="mb-[25px] flex items-center gap-2.5 border-b pb-[23px] max-[1000px]:gap-[7px] max-md:mb-[22px] max-md:flex-wrap max-md:gap-y-3 max-md:pb-[18px]">
        <div className="flex w-[255px] items-center gap-2 rounded-[7px] border bg-background pl-[11px] text-muted-foreground focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring max-[1000px]:w-[210px] max-md:w-[calc(100%-85px)]">
          <Search className="size-4" />
          <Input
            className="h-[33px] rounded-[7px] border-0 bg-transparent py-2 pr-2 pl-0 text-[11px] shadow-none focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline-none md:text-[12px] dark:bg-transparent"
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
                    <div className="flex flex-col gap-[3px]">
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
                    <Choice
                      label={`Role for ${displayName}`}
                      value={row.role === "admin" ? "Admin" : "Member"}
                      onChange={(newRole) =>
                        void runAction(
                          updateOrgMemberRole(org, row.id, newRole.toLowerCase()),
                          "Role updated",
                          load
                        )
                      }
                      options={["Admin", "Member"]}
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
                                void runAction(
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
      <Dialog
        open={invite === "true"}
        onOpenChange={(o) => {
          if (!o) void setInvite(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite your people</DialogTitle>
            <DialogDescription>
              They&apos;ll get an email with a link to join this organization.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              try {
                const result = await inviteMembers(org, {
                  emails,
                  role,
                  teamId: team || undefined,
                });
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                await load();
                void setInvite(null);
                setEmails("");
                toast.success("Invitations sent");
              } finally {
                setBusy(false);
              }
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="invite-emails">Email addresses</FieldLabel>
                <Textarea
                  id="invite-emails"
                  required
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  placeholder="name@example.com, another@example.com"
                />
              </Field>
              <Field>
                <FieldLabel>Role</FieldLabel>
                <Choice
                  label="Invitation role"
                  value={role}
                  onChange={setRole}
                  options={[
                    { label: "Member", value: "member" },
                    { label: "Admin", value: "admin" },
                  ]}
                />
              </Field>
              <Field>
                <FieldLabel>Team (optional)</FieldLabel>
                <Choice
                  label="Invitation team"
                  value={team}
                  onChange={setTeam}
                  options={[
                    { label: "No team", value: "" },
                    ...overview.teams.map((t) => ({ value: t.id, label: t.name })),
                  ]}
                />
              </Field>
            </FieldGroup>
            <DialogFooter className="mt-6">
              <Button type="submit" disabled={busy}>
                {busy ? "Sending…" : "Send invitations"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!remove}
        onOpenChange={(o) => {
          if (!o) setRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this member?</AlertDialogTitle>
            <AlertDialogDescription>
              They lose access to this organization. Their private files are removed with them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (remove) void runAction(removeOrgMember(org, remove.id), "Member removed", load);
                setRemove(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
