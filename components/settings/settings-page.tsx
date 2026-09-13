"use client";
import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQueryState } from "nuqs";
import { useWorkspace } from "@/components/workspace/store";
import { useWorkspaceRoute } from "@/components/workspace/route";
import { Choice, PersonAvatar } from "@/components/workspace/common";
import {
  MembersPage,
  TeamsPage,
} from "@/components/workspace/organization-pages";
import { ProviderSettings } from "./provider-settings";
import { FamilySettings } from "./family-settings";
import { LockedFolderSettings } from "./locked-folder-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  User,
  Shield,
  Bell,
  Keyboard,
  Users,
  Database,
  Code2,
  TriangleAlert,
  Building2,
  Shapes,
  Lock,
  Webhook,
  ScrollText,
  Plus,
  KeyRound,
  Trash2,
  Monitor,
  Ticket,
  AppWindow,
  Info,
  Mail,
  UserRound,
  Languages,
  Earth,
  Share2,
  AtSign,
  Upload,
  CalendarDays,
  Link2,
  Globe,
  UserPlus,
  FolderTree,
  ChevronRight,
  RotateCcw,
  Search,
  ShieldCheck,
  HardDrive,
  BellRing,
  Folder,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
const personal = [
  ["account", "Account", User],
  ["security", "Security", Shield],
  ["notifications", "Notifications", Bell],
  ["keyboard", "Keyboard shortcuts", Keyboard],
  ["sharing", "Sharing", Users],
  ["family", "Family & members", UserPlus],
  ["storage", "Storage provider", Database],
  ["developer", "API / Developer", Code2],
  ["danger", "Danger zone", TriangleAlert],
] as const;
const organization = [
  ["general", "General", Building2],
  ["members", "Members", Users],
  ["teams", "Teams", Shapes],
  ["storage", "Storage provider", Database],
  ["permissions", "Permissions", Lock],
  ["sharing", "Sharing", Users],
  ["security", "Security", Shield],
  ["developer", "API / Developer", Code2],
  ["webhooks", "Webhooks", Webhook],
  ["audit", "Audit log", ScrollText],
  ["danger", "Danger zone", TriangleAlert],
] as const;
export function SettingsPage() {
  const { org } = useWorkspaceRoute();
  const [section, setSection] = useQueryState("section", {
    defaultValue: org ? "general" : "account",
    history: "push",
  });
  const links = org ? organization : personal;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            {org ? "Organization settings" : "Settings"}
            <span className="heading-dot">.</span>
          </h1>
          <p>Make this space work for you.</p>
        </div>
      </div>
      <div className="settings-layout">
        <nav className="settings-navigation" aria-label="Settings sections">
          {links.map(([id, label, Icon]) => (
            <button
              key={id}
              className={section === id ? "active" : ""}
              aria-current={section === id ? "page" : undefined}
              onClick={() => void setSection(id)}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>
        <div className="settings-content">
          {section === "family" && !org ? (
            <FamilySettings />
          ) : section === "storage" ? (
            <ProviderSettings />
          ) : section === "members" ? (
            <MembersPage />
          ) : section === "teams" ? (
            <TeamsPage />
          ) : section === "developer" ||
            section === "api" ||
            section === "webhooks" ? (
            <DeveloperSettings
              key={section}
              webhooks={section === "webhooks"}
            />
          ) : section === "audit" ? (
            <AuditLog />
          ) : (
            <Preferences key={section} section={section} />
          )}
        </div>
      </div>
    </>
  );
}
function Preferences({ section }: { section: string }) {
  const { data, update, user } = useWorkspace();
  const { workspace, org } = useWorkspaceRoute();
  const [name, setName] = useState(
    String(
      data.preferences[`${workspace}:name`] ||
        (org
          ? data.organizations.find((o) => o.id === org)?.name
          : user.name) ||
        "",
    ),
  );
  const [email, setEmail] = useState(
    String(data.preferences[`${workspace}:email`] || user.email),
  );
  const [saved, setSaved] = useState({ name, email });
  const [confirm, setConfirm] = useState(false);
  const dirty = name !== saved.name || email !== saved.email;
  const pref = (key: string) => data.preferences[`${workspace}:${key}`];
  const set = (key: string, value: string | boolean) =>
    update((d) => ({
      ...d,
      preferences: { ...d.preferences, [`${workspace}:${key}`]: value },
    }));
  const row = (
    key: string,
    Icon: LucideIcon,
    title: string,
    description: string,
    defaultOn = true,
  ) => (
    <div className="setting-row" key={key}>
      <span className="setting-icon" aria-hidden="true">
        <Icon />
      </span>
      <div className="setting-row-text">
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <Switch
        aria-label={title}
        checked={pref(key) === undefined ? defaultOn : Boolean(pref(key))}
        onCheckedChange={(v) => {
          set(key, v);
          toast.success("Preference saved");
        }}
      />
    </div>
  );
  if (section === "account" || section === "general")
    return (
      <>
        <div className="settings-section-heading">
          <h2>{org ? "Organization profile" : "Your profile"}</h2>
          <p>
            {org
              ? "The details that bring your team together."
              : "A few details that make this workspace yours."}
          </p>
        </div>
        <form
          className="settings-card"
          aria-labelledby="profile-card-title"
          onSubmit={(e) => {
            e.preventDefault();
            set("name", name);
            set("email", email);
            if (org)
              update((d) => ({
                ...d,
                organizations: d.organizations.map((o) =>
                  o.id === org ? { ...o, name } : o,
                ),
              }));
            setSaved({ name, email });
            toast.success("Demo profile saved");
          }}
        >
          <header className="profile-card-header">
            <PersonAvatar name={name.trim() || user.name} />
            <div className="min-w-0">
              <h3 id="profile-card-title">{name.trim() || "Unnamed"}</h3>
              <p>{email}</p>
            </div>
            <Badge variant="secondary" className="profile-card-badge">
              {org ? <Building2 /> : <UserRound />}
              {org ? "Organization" : "Personal workspace"}
            </Badge>
          </header>
          <div className="settings-card-body">
            <FieldGroup className="settings-card-grid">
              <Field>
                <FieldLabel htmlFor="profile-name">
                  {org ? "Organization name" : "Full name"}
                </FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="profile-name"
                    autoComplete={org ? "organization" : "name"}
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <InputGroupAddon>
                    {org ? <Building2 /> : <UserRound />}
                  </InputGroupAddon>
                </InputGroup>
                <FieldDescription>
                  {org
                    ? "Shown to members and in shared links."
                    : "How collaborators see you."}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="profile-email">
                  {org ? "Contact email" : "Email address"}
                </FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="profile-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <InputGroupAddon>
                    <Mail />
                  </InputGroupAddon>
                </InputGroup>
                <FieldDescription>
                  {org
                    ? "Where members can reach an admin."
                    : "Used for notifications, not sign-in."}
                </FieldDescription>
              </Field>
            </FieldGroup>
          </div>
          <footer className="settings-card-footer">
            <p className="demo-note">
              <Info className="size-3.5" />
              Demo profile only; sign-in details are unchanged.
            </p>
            <div className="settings-card-actions">
              {dirty && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setName(saved.name);
                    setEmail(saved.email);
                  }}
                >
                  Discard
                </Button>
              )}
              <Button type="submit" disabled={!dirty}>
                Save changes
              </Button>
            </div>
          </footer>
        </form>
        <SettingsCard
          className="mt-4"
          title="Language & region"
          description="Changes apply right away."
        >
          <div className="settings-card-body">
            <FieldGroup className="settings-card-grid">
              <Field>
                <FieldLabel>
                  <Languages />
                  Language
                </FieldLabel>
                <Choice
                  label="Language"
                  className="w-full"
                  value={String(pref("language") || "English")}
                  onChange={(v) => {
                    set("language", v);
                    toast.success("Language updated");
                  }}
                  options={["English", "Hindi", "French", "German"]}
                />
              </Field>
              <Field>
                <FieldLabel>
                  <Earth />
                  Timezone
                </FieldLabel>
                <Choice
                  label="Timezone"
                  className="w-full"
                  value={String(pref("timezone") || "Asia/Kolkata")}
                  onChange={(v) => {
                    set("timezone", v);
                    toast.success("Timezone updated");
                  }}
                  options={[
                    "Asia/Kolkata",
                    "America/New_York",
                    "Europe/London",
                    "UTC",
                  ]}
                />
              </Field>
            </FieldGroup>
          </div>
        </SettingsCard>
      </>
    );
  if (section === "keyboard")
    return (
      <>
        <div className="settings-section-heading">
          <h2>A little less clicking</h2>
          <p>
            Move through your workspace with keyboard shortcuts. On Windows and
            Linux, use Ctrl in place of ⌘.
          </p>
        </div>
        <div className="settings-stack">
          {shortcutGroups.map((group) => (
            <SettingsCard
              key={group.title}
              title={group.title}
              description={group.description}
            >
              <dl className="shortcut-list">
                {group.items.map(([action, keys]) => (
                  <div className="shortcut-row" key={action}>
                    <dt>{action}</dt>
                    <dd>
                      {keys.map((k) => (
                        <kbd key={k}>{k}</kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </SettingsCard>
          ))}
        </div>
      </>
    );
  if (section === "notifications")
    return (
      <>
        <div className="settings-section-heading">
          <h2>Stay in the loop</h2>
          <p>Choose the updates that matter to you.</p>
        </div>
        <div className="settings-stack">
          <SettingsCard
            title="Collaboration"
            description="Updates from the people you work with."
          >
            {row(
              "notify-shares",
              Share2,
              "File sharing",
              "When someone shares a file or folder with you.",
            )}
            {row(
              "notify-mentions",
              AtSign,
              "Mentions and collaboration",
              "When teammates need your attention.",
            )}
          </SettingsCard>
          <SettingsCard
            title="Activity"
            description="Uploads, storage, and your weekly recap."
          >
            {row(
              "notify-uploads",
              Upload,
              "Upload activity",
              "When your uploads finish or need a retry.",
            )}
            {row(
              "notify-storage",
              HardDrive,
              "Storage alerts",
              "When a storage provider has a connection or sync issue.",
            )}
            {row(
              "notify-digest",
              CalendarDays,
              "Weekly activity digest",
              "A quiet recap of what happened this week.",
              false,
            )}
          </SettingsCard>
        </div>
        <p className="demo-note mt-4">
          <Info className="size-3.5" />
          Notification preferences are saved locally in this demo.
        </p>
      </>
    );
  if (section === "security")
    return (
      <>
        <div className="settings-section-heading">
          <h2>Keep your space secure</h2>
          <p>Manage how you access your workspace.</p>
        </div>
        <div className="settings-stack">
          {!org && <LockedFolderSettings />}
          <SettingsCard
            title="Sign-in"
            description="How you prove it’s really you."
          >
            <div className="setting-row">
              <span className="setting-icon" aria-hidden="true">
                <KeyRound />
              </span>
              <div className="setting-row-text">
                <strong>Password</strong>
                <p>Update your password using a secure email link.</p>
              </div>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/forgot-password" />}
              >
                Reset password
              </Button>
            </div>
            <div className="setting-row">
              <span className="setting-icon" aria-hidden="true">
                <ShieldCheck />
              </span>
              <div className="setting-row-text">
                <strong>Two-factor authentication</strong>
                <p>Requires backend setup before enrollment.</p>
              </div>
              <Badge variant="outline">Not configured</Badge>
            </div>
            {row(
              "login-alert",
              BellRing,
              "Sign-in alerts",
              "Notify me about new device sign-ins.",
            )}
          </SettingsCard>
          <SettingsCard
            title="Sessions"
            description="Devices currently signed in to your account."
          >
            <div className="setting-row">
              <span className="setting-icon" aria-hidden="true">
                <Monitor />
              </span>
              <div className="setting-row-text">
                <strong>This device</strong>
                <p>Current browser session</p>
              </div>
              <Badge variant="secondary" className="gap-1.5">
                <span className="provider-status-dot" aria-hidden="true" />
                Active now
              </Badge>
            </div>
          </SettingsCard>
        </div>
        <p className="demo-note mt-4">
          <Info className="size-3.5" />
          Security preferences shown here are a UI preview.
        </p>
      </>
    );
  if (section === "sharing" || section === "permissions")
    return (
      <>
        <div className="settings-section-heading">
          <h2>
            {section === "sharing"
              ? "Better, together"
              : "The right level of access"}
          </h2>
          <p>Set thoughtful defaults for your workspace.</p>
        </div>
        <div className="settings-stack">
          <SettingsCard
            title="Defaults"
            description="Applied whenever files and folders are shared."
          >
            <div className="setting-row">
              <span className="setting-icon" aria-hidden="true">
                <UserPlus />
              </span>
              <div className="setting-row-text">
                <strong>Default sharing permission</strong>
                <p>Access level for new collaborators.</p>
              </div>
              <Choice
                label="Default permission"
                className="w-32"
                value={String(pref("permission") || "Viewer")}
                onChange={(v) => {
                  set("permission", v);
                  toast.success("Preference saved");
                }}
                options={["Viewer", "Editor", "Manager"]}
              />
            </div>
            {row(
              "public-sharing",
              Link2,
              "Allow public links",
              "Let members create links accessible outside the workspace.",
              false,
            )}
            {row(
              "external-sharing",
              Globe,
              "External collaborators",
              "Allow sharing with people outside your organization.",
              false,
            )}
            {row(
              "inherit",
              FolderTree,
              "Inherit folder permissions",
              "Files inherit access from their parent folder.",
            )}
          </SettingsCard>
          <SettingsCard
            title="Permission inheritance"
            description="Inherited permissions are shown in each file’s sharing dialog."
          >
            <ol className="permission-chain">
              {inheritance.map(([label, Icon], i) => (
                <li key={label}>
                  {i > 0 && (
                    <ChevronRight
                      className="permission-chain-arrow"
                      aria-hidden="true"
                    />
                  )}
                  <span>
                    <Icon aria-hidden="true" />
                    {label}
                  </span>
                </li>
              ))}
            </ol>
          </SettingsCard>
        </div>
        <p className="demo-note mt-4">
          <Info className="size-3.5" />
          These are demo preferences, not enforced access controls.
        </p>
      </>
    );
  if (section === "danger")
    return (
      <>
        <div className="settings-section-heading">
          <h2>Danger zone</h2>
          <p>Changes here need a little extra care.</p>
        </div>
        <SettingsCard className="danger-card">
          <div className="setting-row">
            <span className="setting-icon" aria-hidden="true">
              <RotateCcw />
            </span>
            <div className="setting-row-text">
              <strong>Reset this workspace demo</strong>
              <p>
                Remove local file metadata, teams, and demo members for this
                workspace. Your real account is unaffected.
              </p>
            </div>
            <Button variant="destructive" onClick={() => setConfirm(true)}>
              Reset workspace
            </Button>
          </div>
        </SettingsCard>
        <AlertDialog open={confirm} onOpenChange={setConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset this demo workspace?</AlertDialogTitle>
              <AlertDialogDescription>
                All local file metadata and team data for this workspace will be
                removed. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  update((d) => ({
                    ...d,
                    files: d.files.filter((f) => f.workspace !== workspace),
                    teams: d.teams.filter((t) => t.workspace !== workspace),
                    members: d.members.filter((m) => m.workspace !== workspace),
                  }));
                  setConfirm(false);
                  toast.success("Workspace demo reset");
                }}
              >
                Reset workspace
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  return (
    <div className="settings-section-heading">
      <h2>Settings section not found</h2>
      <p>Select a section from the settings menu.</p>
    </div>
  );
}
type Credential = {
  id: string;
  name: string;
  date: string;
  permission: string;
  kind: string;
  url?: string;
};
const developerKinds = {
  keys: {
    label: "API keys",
    singular: "API key",
    noun: "key",
    icon: KeyRound,
    description: "Authenticate server-to-server requests to this workspace.",
    emptyTitle: "No API keys yet",
    empty: "Create a key to call the API from your own services.",
  },
  tokens: {
    label: "Access tokens",
    singular: "access token",
    noun: "token",
    icon: Ticket,
    description: "Personal tokens for scripts and command-line tools.",
    emptyTitle: "No access tokens yet",
    empty: "Create a token to use the CLI or run quick scripts.",
  },
  webhooks: {
    label: "Webhooks",
    singular: "webhook",
    noun: "webhook",
    icon: Webhook,
    description: "Send file and upload events to your endpoint as they happen.",
    emptyTitle: "No webhooks yet",
    empty: "Add an endpoint to receive events from this workspace.",
  },
  oauth: {
    label: "OAuth apps",
    singular: "OAuth application",
    noun: "app",
    icon: AppWindow,
    description: "Let other apps request access on behalf of your users.",
    emptyTitle: "No OAuth apps yet",
    empty: "Register an app so it can sign users in with this workspace.",
  },
};
type DeveloperKind = keyof typeof developerKinds;
const developerKindIds = Object.keys(developerKinds) as DeveloperKind[];
const webhookEvents = [
  "file.created",
  "file.updated",
  "file.deleted",
  "file.moved",
  "file.shared",
  "upload.completed",
];
function DeveloperSettings({ webhooks = false }: { webhooks?: boolean }) {
  const { data, update } = useWorkspace();
  const { workspace } = useWorkspaceRoute();
  const [tab, setTab] = useQueryState("tab", {
    defaultValue: webhooks ? "webhooks" : "keys",
    history: "push",
  });
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [permission, setPermission] = useState("Read only");
  const key = `${workspace}:developer`;
  const records: Credential[] = JSON.parse(
    String(data.preferences[key] || "[]"),
  );
  const kind: DeveloperKind =
    tab in developerKinds ? (tab as DeveloperKind) : "keys";
  const current = developerKinds[kind];
  const scopeLabel =
    workspace === "personal"
      ? "Personal workspace"
      : data.organizations.find((o) => o.id === workspace)?.name || workspace;
  const save = (items: Credential[]) =>
    update((d) => ({
      ...d,
      preferences: { ...d.preferences, [key]: JSON.stringify(items) },
    }));
  function openCreate() {
    setName("");
    setUrl("");
    setPermission(kind === "webhooks" ? "All file events" : "Read only");
    setModal(true);
  }
  return (
    <>
      <div className="settings-section-heading developer-heading">
        <div>
          <h2>Built to connect</h2>
          <p>Connect your workspace to the tools and workflows you build.</p>
        </div>
        <Badge variant="outline" className="developer-scope">
          <span className="developer-scope-dot" aria-hidden="true" />
          {scopeLabel}
        </Badge>
      </div>
      <Tabs value={kind} onValueChange={(v) => void setTab(String(v))}>
        <TabsList variant="line" className="developer-tabs">
          {developerKindIds.map((id) => {
            const Icon = developerKinds[id].icon;
            const count = records.filter((r) => r.kind === id).length;
            return (
              <TabsTrigger key={id} value={id}>
                <Icon />
                {developerKinds[id].label}
                {count > 0 && <span className="developer-count">{count}</span>}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {developerKindIds.map((id) => {
          const info = developerKinds[id];
          const Icon = info.icon;
          const items = records.filter((r) => r.kind === id);
          return (
            <TabsContent key={id} value={id}>
              <section className="developer-panel">
                <header className="developer-panel-header">
                  <div>
                    <h3>
                      {info.label}
                      <Badge variant="secondary">Demo</Badge>
                    </h3>
                    <p>{info.description}</p>
                  </div>
                  {items.length > 0 && (
                    <Button onClick={openCreate}>
                      <Plus />
                      Create {info.noun}
                    </Button>
                  )}
                </header>
                {items.length > 0 ? (
                  <div className="developer-table">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>
                            {id === "webhooks" ? "Events" : "Permissions"}
                          </TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>
                            <span className="sr-only">Actions</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              <span className="developer-name">
                                <span className="developer-icon">
                                  <Icon />
                                </span>
                                <span className="min-w-0">
                                  <strong>{r.name}</strong>
                                  {r.url && <small title={r.url}>{r.url}</small>}
                                </span>
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{r.permission}</Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(r.date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">Demo</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Revoke ${r.name}`}
                                title="Revoke"
                                onClick={() => {
                                  const previous = records;
                                  save(records.filter((x) => x.id !== r.id));
                                  toast.success(`${r.name} revoked`, {
                                    action: {
                                      label: "Undo",
                                      onClick: () => save(previous),
                                    },
                                  });
                                }}
                              >
                                <Trash2 />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <Empty className="developer-empty">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Icon />
                      </EmptyMedia>
                      <EmptyTitle>{info.emptyTitle}</EmptyTitle>
                      <EmptyDescription>{info.empty}</EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button onClick={openCreate}>
                        <Plus />
                        Create {info.noun}
                      </Button>
                    </EmptyContent>
                  </Empty>
                )}
              </section>
              {id === "webhooks" && (
                <section className="webhook-events">
                  <h3>Available events</h3>
                  <p>Pick any of these when you add an endpoint.</p>
                  <ul>
                    {webhookEvents.map((e) => (
                      <li key={e}>
                        <code>{e}</code>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <p className="demo-note mt-4">
                <Info className="size-3.5" />
                Demo records only. No usable credentials are generated and
                endpoints are never called.
              </p>
            </TabsContent>
          );
        })}
      </Tabs>
      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create {current.singular}</DialogTitle>
            <DialogDescription>
              {current.description} Scoped to {scopeLabel}.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save([
                ...records,
                {
                  id: crypto.randomUUID(),
                  name,
                  date: new Date().toISOString(),
                  permission,
                  kind,
                  url: url || undefined,
                },
              ]);
              setModal(false);
              toast.success(`${name} created`);
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="credential-name">Name</FieldLabel>
                <Input
                  id="credential-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder={
                    kind === "webhooks" ? "Slack notifier" : "My integration"
                  }
                />
              </Field>
              {(kind === "webhooks" || kind === "oauth") && (
                <Field>
                  <FieldLabel htmlFor="credential-url">
                    {kind === "oauth" ? "Redirect URL" : "Endpoint URL"}
                  </FieldLabel>
                  <Input
                    id="credential-url"
                    type="url"
                    pattern="https://.*"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    placeholder="https://example.com/callback"
                  />
                </Field>
              )}
              <Field>
                <FieldLabel>
                  {kind === "webhooks" ? "Events" : "Permissions"}
                </FieldLabel>
                <Choice
                  label={kind === "webhooks" ? "Events" : "Permissions"}
                  value={permission}
                  onChange={setPermission}
                  options={
                    kind === "webhooks"
                      ? ["All file events", ...webhookEvents]
                      : ["Read only", "Read and write", "Full access"]
                  }
                />
              </Field>
            </FieldGroup>
            <p className="demo-note mt-4">
              No usable credentials are generated. Connect your backend to issue
              and manage secrets securely.
            </p>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Create {current.noun}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
function AuditLog() {
  const { data, user } = useWorkspace();
  const [search, setSearch] = useQueryState("search", { defaultValue: "" });
  const [action, setAction] = useQueryState("action", { defaultValue: "all" });
  const events = data.events.filter(
    (e) =>
      (action === "all" || e.action === action) &&
      e.resource.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="settings-section-heading">
        <h2>Workspace audit log</h2>
        <p>A clear record of what happened, and when.</p>
      </div>
      <section className="settings-card">
        <div className="audit-toolbar">
          <InputGroup className="audit-search">
            <InputGroupInput
              value={search}
              onChange={(e) => void setSearch(e.target.value)}
              placeholder="Search resources…"
              aria-label="Search audit log"
            />
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
          </InputGroup>
          <Choice
            label="Audit action"
            className="w-44"
            value={action}
            onChange={setAction}
            options={[
              { label: "All actions", value: "all" },
              ...Array.from(new Set(data.events.map((e) => e.action))),
            ]}
          />
          <span className="audit-count">
            {events.length} {events.length === 1 ? "event" : "events"}
          </span>
        </div>
        {events.length > 0 ? (
          <div className="developer-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <span className="developer-name">
                        <PersonAvatar name={user.name} className="size-7" />
                        <strong>{user.name}</strong>
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {e.action}
                      </Badge>
                    </TableCell>
                    <TableCell>{e.resource}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <time dateTime={e.date}>
                        {new Date(e.date).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </time>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Empty className="developer-empty">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ScrollText />
              </EmptyMedia>
              <EmptyTitle>No matching events</EmptyTitle>
              <EmptyDescription>
                Try a different resource name or action.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="outline"
                onClick={() => {
                  void setSearch(null);
                  void setAction(null);
                }}
              >
                Clear filters
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </section>
      <p className="demo-note mt-4">
        <Info className="size-3.5" />
        Local demonstration events. Production audit logging requires a backend.
      </p>
    </>
  );
}
function SettingsCard({
  title,
  description,
  className,
  children,
}: {
  title?: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      className={className ? `settings-card ${className}` : "settings-card"}
      aria-labelledby={title ? id : undefined}
    >
      {title && (
        <header className="settings-card-header">
          <h3 id={id}>{title}</h3>
          {description && <p>{description}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
const shortcutGroups: {
  title: string;
  description: string;
  items: [string, string[]][];
}[] = [
  {
    title: "Navigation",
    description: "Find, open, and close things quickly.",
    items: [
      ["Search anything", ["⌘", "K"]],
      ["Upload files", ["⌘", "U"]],
      ["Open selected file", ["Enter"]],
      ["Preview selected file", ["Space"]],
      ["Clear selection / close dialog", ["Esc"]],
    ],
  },
  {
    title: "Selection",
    description: "Work with many files at once.",
    items: [
      ["Select all files", ["⌘", "A"]],
      ["Select a range", ["Shift", "Click"]],
      ["Add to selection", ["⌘", "Click"]],
      ["Move selection to trash", ["Delete"]],
    ],
  },
];
const inheritance = [
  ["Organization", Building2],
  ["Team", Shapes],
  ["Folder", Folder],
  ["File", FileText],
] as const;
