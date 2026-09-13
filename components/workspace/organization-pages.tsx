"use client";

import {
  Activity,
  ArrowUpRight,
  Code2,
  Database,
  Folder,
  Mail,
  Megaphone,
  MoreHorizontal,
  Palette,
  Plus,
  Search,
  Shapes,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { useState } from "react";
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
import { Choice, EmptyState, PersonAvatar } from "./common";
import { useWorkspaceRoute } from "./route";
import { useWorkspace } from "./store";

export function OrganizationPage() {
  const { data } = useWorkspace();
  const { workspace, base } = useWorkspaceRoute();
  const router = useRouter();
  const org = data.organizations.find((o) => o.id === workspace);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR SHARED WORKSPACE</div>
          <h1>
            {org?.name || "Organization"}
            {!org?.name.endsWith(".") && <span className="heading-dot">.</span>}
          </h1>
          <p>Good work starts with a connected team.</p>
        </div>
        <Button onClick={() => router.push(`${base}/members?invite=true`)}>
          <Plus />
          Invite members
        </Button>
      </div>
      <div className="metric-grid">
        {[
          {
            label: "Storage used",
            value: "824 GB",
            caption: "Stored in this workspace",
            icon: Database,
          },
          {
            label: "Members",
            value: String(data.members.filter((m) => m.workspace === workspace).length),
            caption: "Working better together",
            icon: Users,
          },
          {
            label: "Teams",
            value: String(data.teams.filter((t) => t.workspace === workspace).length),
            caption: "A place for every project",
            icon: Shapes,
          },
          {
            label: "Files",
            value: String(data.files.filter((f) => f.workspace === workspace && !f.trashed).length),
            caption: "Ideas, all in one place",
            icon: Folder,
          },
        ].map((m) => (
          <Card key={m.label}>
            <CardHeader>
              <CardDescription className="flex items-center justify-between">
                {m.label}
                <m.icon className="size-4" />
              </CardDescription>
              <CardTitle className="metric-value">{m.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{m.caption}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <TeamsPage embedded />
      <section className="activity-section">
        <div className="section-heading">
          <h2>Workspace activity</h2>
          <Button variant="ghost" onClick={() => router.push(`${base}/settings?section=audit`)}>
            View audit log
            <ArrowUpRight />
          </Button>
        </div>
        {data.events.slice(0, 5).map((e) => (
          <div className="activity-row" key={e.id}>
            <span className="activity-symbol">
              <Activity />
            </span>
            <div>
              <strong>{e.resource}</strong>
              <p>{e.action.replaceAll(".", " ").replaceAll("_", " ")}</p>
            </div>
            <small>
              {new Date(e.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </small>
          </div>
        ))}
      </section>
    </>
  );
}
export function TeamsPage({ embedded = false }: { embedded?: boolean }) {
  const { data, update } = useWorkspace();
  const { workspace, base } = useWorkspaceRoute();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("green");
  const teams = data.teams.filter((t) => t.workspace === workspace);
  return (
    <>
      <div className={embedded ? "section-heading mt-9" : "page-heading"}>
        <div>
          {embedded ? (
            <h2>Your teams</h2>
          ) : (
            <>
              <h1>
                Teams<span className="heading-dot">.</span>
              </h1>
              <p>A shared home for every kind of work.</p>
            </>
          )}
        </div>
        <Button variant={embedded ? "ghost" : "default"} onClick={() => setOpen(true)}>
          <Plus />
          Create team
        </Button>
      </div>
      <div className="team-grid">
        {teams.map((t, i) => {
          const Icon = [Code2, Palette, Megaphone][i % 3];
          return (
            <Card key={t.id} className="team-card">
              <CardHeader>
                <div className={`team-emblem ${t.color}`}>
                  <Icon />
                </div>
                <CardTitle>
                  <button onClick={() => router.push(`${base}/teams/${t.id}`)}>
                    {t.name}
                    <ArrowUpRight className="size-4" />
                  </button>
                </CardTitle>
                <CardDescription>{t.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="team-stats">
                  <span>
                    <Users />
                    {t.members} members
                  </span>
                  <span>
                    <Folder />
                    {t.files.toLocaleString()} files
                  </span>
                  <span>{t.storage}</span>
                </div>
              </CardContent>
              <CardFooter>
                <span className="intro-avatars">
                  {data.members
                    .filter((m) => m.workspace === workspace && m.team === t.id)
                    .slice(0, 3)
                    .map((m) => (
                      <PersonAvatar key={m.id} name={m.name} />
                    ))}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`${base}/teams/${t.id}`)}
                >
                  Open workspace
                  <ArrowUpRight />
                </Button>
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
          <Button onClick={() => setOpen(true)}>Create team</Button>
        </EmptyState>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a team</DialogTitle>
            <DialogDescription>Make room for your next collaboration.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
              if (!id || teams.some((t) => t.id === id)) {
                toast.error("Choose a unique team name");
                return;
              }
              update((d) => ({
                ...d,
                teams: [
                  ...d.teams,
                  {
                    id,
                    name,
                    description,
                    members: 1,
                    files: 0,
                    storage: "0 B",
                    color,
                    workspace,
                  },
                ],
              }));
              setOpen(false);
              router.push(`${base}/teams/${id}`);
              toast.success("Team created");
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
              <Button type="submit">Create team</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function MembersPage({ teamOnly }: { teamOnly?: string } = {}) {
  const { data, update } = useWorkspace();
  const { workspace } = useWorkspaceRoute();
  const [search, setSearch] = useQueryState("search", { defaultValue: "" });
  const [status, setStatus] = useQueryState("status", { defaultValue: "all" });
  const [invite, setInvite] = useQueryState("invite");
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState("Member");
  const [team, setTeam] = useState(teamOnly || "engineering");
  const [remove, setRemove] = useState<string | null>(null);
  const members = data.members.filter(
    (m) =>
      m.workspace === workspace &&
      (!teamOnly || m.team === teamOnly) &&
      `${m.name} ${m.email}`.toLowerCase().includes(search.toLowerCase()) &&
      (status === "all" || status === m.status)
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            Members<span className="heading-dot">.</span>
          </h1>
          <p>The people who make it all happen.</p>
        </div>
        <Button onClick={() => void setInvite("true")}>
          <Plus />
          Invite members
        </Button>
      </div>
      <div className="browser-toolbar">
        <div className="file-search">
          <Search className="size-4" />
          <Input
            aria-label="Search members"
            placeholder="Search members…"
            value={search}
            onChange={(e) => void setSearch(e.target.value)}
          />
        </div>
        <Choice
          label="Member status"
          value={status}
          onChange={setStatus}
          options={[{ label: "All statuses", value: "all" }, "Active", "Invited", "Suspended"]}
        />
        <span className="ml-auto text-sm text-muted-foreground">{members.length} members</span>
      </div>
      <Table className="members-table">
        <TableHeader>
          <TableRow>
            {["Member", "Role", "Team", "Status", "Last active", ""].map((s, i) => (
              <TableHead key={i}>{s}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.id}>
              <TableCell>
                <div className="share-person">
                  <PersonAvatar name={m.name} />
                  <div>
                    <strong>{m.name}</strong>
                    <small>{m.email}</small>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {m.role === "Owner" ? (
                  "Owner"
                ) : (
                  <Choice
                    label={`Role for ${m.name}`}
                    value={m.role}
                    onChange={(role) => {
                      update((d) => ({
                        ...d,
                        members: d.members.map((x) => (x.id === m.id ? { ...x, role } : x)),
                      }));
                      toast.success("Role updated");
                    }}
                    options={["Admin", "Member"]}
                  />
                )}
              </TableCell>
              <TableCell className="capitalize">{m.team}</TableCell>
              <TableCell>
                <Badge variant={m.status === "Active" ? "secondary" : "outline"}>{m.status}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {m.status === "Invited"
                  ? "Not yet joined"
                  : m.status === "Suspended"
                    ? "—"
                    : "Today"}
              </TableCell>
              <TableCell>
                {m.role !== "Owner" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${m.name}`} />
                      }
                    >
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuGroup>
                        {m.status === "Invited" ? (
                          <DropdownMenuItem
                            onClick={() =>
                              toast.info(
                                "Demo only. Connect an email backend to resend invitations."
                              )
                            }
                          >
                            <Mail />
                            Resend invitation
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() =>
                              update((d) => ({
                                ...d,
                                members: d.members.map((x) =>
                                  x.id === m.id
                                    ? {
                                        ...x,
                                        status: x.status === "Suspended" ? "Active" : "Suspended",
                                      }
                                    : x
                                ),
                              }))
                            }
                          >
                            {m.status === "Suspended" ? "Reactivate" : "Suspend"} member
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem variant="destructive" onClick={() => setRemove(m.id)}>
                          Remove member
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!members.length && (
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
              Add invitations to this demo workspace. No emails will be sent.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const list = emails.split(/[;,\s]+/).filter(Boolean);
              if (!list.length || !list.every((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))) {
                toast.error("Enter valid email addresses");
                return;
              }
              update((d) => ({
                ...d,
                members: [
                  ...d.members,
                  ...list
                    .filter(
                      (email) =>
                        !d.members.some((m) => m.email === email && m.workspace === workspace)
                    )
                    .map((email) => ({
                      id: crypto.randomUUID(),
                      name: email.split("@")[0],
                      email,
                      role,
                      status: "Invited",
                      team,
                      workspace,
                    })),
                ],
              }));
              toast.success("Demo invitations added");
              void setInvite(null);
              setEmails("");
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
                  options={["Member", "Admin"]}
                />
              </Field>
              <Field>
                <FieldLabel>Team</FieldLabel>
                <Choice
                  label="Invitation team"
                  value={team}
                  onChange={setTeam}
                  options={data.teams
                    .filter((t) => t.workspace === workspace)
                    .map((t) => ({ value: t.id, label: t.name }))}
                />
              </Field>
            </FieldGroup>
            <DialogFooter className="mt-6">
              <Button type="submit">Add invitations</Button>
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
              They will be removed from this demo organization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                update((d) => ({
                  ...d,
                  members: d.members.filter((m) => m.id !== remove),
                }));
                setRemove(null);
                toast.success("Member removed");
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
