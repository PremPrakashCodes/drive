"use client";

import type { LucideIcon } from "lucide-react";
import {
  AppWindow,
  AtSign,
  Bell,
  BellRing,
  Building2,
  CalendarDays,
  ChevronRight,
  Code2,
  Database,
  Earth,
  FileText,
  Folder,
  FolderTree,
  Globe,
  HardDrive,
  Info,
  Keyboard,
  KeyRound,
  Languages,
  Link2,
  Lock,
  Mail,
  Monitor,
  Plus,
  RotateCcw,
  ScrollText,
  Search,
  Shapes,
  Share2,
  Shield,
  ShieldCheck,
  Ticket,
  Trash2,
  TriangleAlert,
  Upload,
  User,
  UserPlus,
  UserRound,
  Users,
  Webhook,
} from "lucide-react";
import Link from "next/link";
import { useQueryState } from "nuqs";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Choice, PersonAvatar } from "@/components/workspace/common";
import { MembersPage, TeamsPage } from "@/components/workspace/organization-pages";
import { useWorkspaceRoute } from "@/components/workspace/route";
import { useWorkspace } from "@/components/workspace/store";
import { formatDateTime, formatMediumDate } from "@/lib/date";
import { deleteItems } from "@/lib/drive/items";
import { cn } from "@/lib/utils";
import { FamilySettings } from "./family-settings";
import { LockedFolderSettings } from "./locked-folder-settings";
import { ProviderSettings } from "./provider-settings";

// Shared settings styles (kept identical across components/settings/*).
const sectionTitleClass = "text-[19px] font-medium tracking-[-0.4px]";
const sectionDescriptionClass = "mt-2 text-[12px] leading-[1.7] text-muted-foreground";
const cardClass = "overflow-hidden rounded-[14px] border bg-card";
const cardHeaderClass = "border-b px-5 py-4 max-md:px-4";
const cardTitleClass = "text-[14px] font-medium";
const cardDescriptionClass = "mt-0.5 text-[12px] text-muted-foreground";
const cardBodyClass = "p-5 max-md:px-4";
const cardGridClass = "grid grid-cols-2 gap-5 max-md:grid-cols-1";
const fieldLabelIconClass = "size-3.5 text-muted-foreground";
const stackClass = "flex flex-col gap-4";
const rowClass =
  "flex items-center gap-3.5 px-5 py-3.5 max-md:gap-3 max-md:px-4 max-md:py-3 [&+&]:border-t";
const rowIconClass =
  "grid size-8 shrink-0 place-items-center rounded-[9px] bg-muted text-muted-foreground max-md:hidden [&_svg]:size-4";
const rowTitleClass = "block text-[13px] font-medium";
const rowDescriptionClass = "mt-0.5 text-[12px] leading-[1.5] text-muted-foreground";
const demoNoteClass = "flex items-start gap-[7px] text-[11px] leading-[1.7] text-muted-foreground";
const demoNoteIconClass = "mt-[3px] size-3.5 shrink-0";
const statusDotClass = "size-1.5 rounded-full bg-[#16a34a]";
// Developer / audit tables.
const tableWrapperClass = "overflow-x-auto border-t";
const tableHeadClass =
  "h-[38px] bg-[color-mix(in_srgb,var(--muted)_50%,var(--card))] px-5 text-[11.5px] font-medium text-muted-foreground";
const tableCellClass = "px-5 py-3 text-[12.5px]";
const tableEmptyClass = "rounded-none border-t border-solid px-5 py-12";

// A readable action name for the audit log, derived from a file's state.
function auditAction(file: { kind: string; trashed?: boolean; locked?: boolean }) {
  if (file.trashed) return "file.trashed";
  if (file.locked) return "file.locked";
  return file.kind === "folder" ? "folder.created" : "file.uploaded";
}

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
      <div className="mb-[29px] flex items-center justify-between gap-6 max-md:mb-[23px] max-md:items-start max-md:gap-3">
        <div>
          <h1 className="text-[29px] leading-[1.3] font-[550] tracking-[-1.2px] max-md:text-[27px]">
            {org ? "Organization settings" : "Settings"}
            <span className="text-folder-green">.</span>
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground max-md:max-w-[240px] max-md:text-[11px] max-md:leading-[1.6]">
            Make this space work for you.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-[190px_minmax(0,1fr)] gap-9 border-t pt-[26px] max-[1200px]:grid-cols-[160px_minmax(0,1fr)] max-[1200px]:gap-[25px] max-[1000px]:gap-5 max-md:grid-cols-1 max-md:gap-[26px]">
        <nav
          className="sticky top-5 flex flex-col gap-0.5 self-start max-md:static max-md:flex-row max-md:overflow-x-auto max-md:pb-[5px]"
          aria-label="Settings sections"
        >
          {links.map(([id, label, Icon]) => (
            <button
              key={id}
              className={cn(
                "flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[12.5px] text-muted-foreground transition-[background-color,color] duration-150 ease-[ease] hover:bg-accent/60 hover:text-foreground max-md:shrink-0 max-md:p-2.5 [&_svg]:size-[15px]",
                section === id &&
                  "bg-accent font-medium text-primary hover:bg-accent hover:text-primary"
              )}
              aria-current={section === id ? "page" : undefined}
              onClick={() => void setSection(id)}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>
        <div className="max-w-[1000px] min-w-0">
          {section === "family" && !org ? (
            <FamilySettings />
          ) : section === "storage" ? (
            <ProviderSettings />
          ) : section === "members" ? (
            <MembersPage inSettings />
          ) : section === "teams" ? (
            <TeamsPage inSettings />
          ) : section === "developer" || section === "api" || section === "webhooks" ? (
            <DeveloperSettings key={section} webhooks={section === "webhooks"} />
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
      (org ? data.organizations.find((o) => o.slug === org || o.id === org)?.name : user.name) || ""
    )
  );
  const [email, setEmail] = useState(String(data.preferences[`${workspace}:email`] || user.email));
  const [saved, setSaved] = useState({ name, email });
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
    defaultOn = true
  ) => (
    <div className={rowClass} key={key}>
      <span className={rowIconClass} aria-hidden="true">
        <Icon />
      </span>
      <div className="min-w-0 flex-1">
        <strong className={rowTitleClass}>{title}</strong>
        <p className={rowDescriptionClass}>{description}</p>
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
        <div className="mb-[26px]">
          <h2 className={sectionTitleClass}>{org ? "Organization profile" : "Your profile"}</h2>
          <p className={sectionDescriptionClass}>
            {org
              ? "The details that bring your team together."
              : "A few details that make this workspace yours."}
          </p>
        </div>
        <form
          className={cardClass}
          aria-labelledby="profile-card-title"
          onSubmit={(e) => {
            e.preventDefault();
            setSaved({ name, email });
            toast.success("Profile details are shown from your account");
          }}
        >
          <header className="flex items-center gap-3.5 border-b bg-[color-mix(in_srgb,var(--muted)_40%,var(--card))] p-5 max-md:flex-wrap max-md:p-4">
            <PersonAvatar
              name={name.trim() || user.name}
              className="size-[52px]! shadow-[0_0_0_3px_var(--card),0_0_0_4px_var(--border)] [&_[data-slot=avatar-fallback]]:text-[17px]! [&_[data-slot=avatar-fallback]]:font-medium!"
            />
            <div className="min-w-0">
              <h3
                id="profile-card-title"
                className="truncate text-[16px] font-semibold tracking-[-0.2px]"
              >
                {name.trim() || "Unnamed"}
              </h3>
              <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{email}</p>
            </div>
            <Badge variant="secondary" className="ml-auto shrink-0 max-md:ml-0">
              {org ? <Building2 /> : <UserRound />}
              {org ? "Organization" : "Personal workspace"}
            </Badge>
          </header>
          <div className={cardBodyClass}>
            <FieldGroup className={cardGridClass}>
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
                  <InputGroupAddon>{org ? <Building2 /> : <UserRound />}</InputGroupAddon>
                </InputGroup>
                <FieldDescription>
                  {org ? "Shown to members and in shared links." : "How collaborators see you."}
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
          <footer className="flex items-center justify-between gap-4 border-t bg-[color-mix(in_srgb,var(--muted)_60%,var(--card))] py-3 pr-4 pl-5 max-md:flex-col max-md:items-stretch max-md:px-4">
            <p className={demoNoteClass}>
              <Info className={demoNoteIconClass} />
              Demo profile only; sign-in details are unchanged.
            </p>
            <div className="flex shrink-0 gap-1.5 max-md:justify-end">
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
          <div className={cardBodyClass}>
            <FieldGroup className={cardGridClass}>
              <Field>
                <FieldLabel>
                  <Languages className={fieldLabelIconClass} />
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
                  <Earth className={fieldLabelIconClass} />
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
                  options={["Asia/Kolkata", "America/New_York", "Europe/London", "UTC"]}
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
        <div className="mb-[26px]">
          <h2 className={sectionTitleClass}>A little less clicking</h2>
          <p className={sectionDescriptionClass}>
            Move through your workspace with keyboard shortcuts. On Windows and Linux, use Ctrl in
            place of ⌘.
          </p>
        </div>
        <div className={stackClass}>
          {shortcutGroups.map((group) => (
            <SettingsCard key={group.title} title={group.title} description={group.description}>
              <dl>
                {group.items.map(([action, keys]) => (
                  <div
                    className="flex items-center justify-between gap-4 px-5 py-[11px] text-[13px] max-md:px-4 max-md:py-2.5 [&+&]:border-t"
                    key={action}
                  >
                    <dt>{action}</dt>
                    <dd className="flex shrink-0 gap-1">
                      {keys.map((k) => (
                        <kbd
                          key={k}
                          className="inline-grid h-6 min-w-6 place-items-center rounded-[6px] border border-b-2 bg-[color-mix(in_srgb,var(--muted)_60%,var(--card))] px-[7px] font-[family-name:inherit] text-[11.5px] font-medium whitespace-nowrap"
                        >
                          {k}
                        </kbd>
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
        <div className="mb-[26px]">
          <h2 className={sectionTitleClass}>Stay in the loop</h2>
          <p className={sectionDescriptionClass}>Choose the updates that matter to you.</p>
        </div>
        <div className={stackClass}>
          <SettingsCard title="Collaboration" description="Updates from the people you work with.">
            {row(
              "notify-shares",
              Share2,
              "File sharing",
              "When someone shares a file or folder with you."
            )}
            {row(
              "notify-mentions",
              AtSign,
              "Mentions and collaboration",
              "When teammates need your attention."
            )}
          </SettingsCard>
          <SettingsCard title="Activity" description="Uploads, storage, and your weekly recap.">
            {row(
              "notify-uploads",
              Upload,
              "Upload activity",
              "When your uploads finish or need a retry."
            )}
            {row(
              "notify-storage",
              HardDrive,
              "Storage alerts",
              "When a storage provider has a connection or sync issue."
            )}
            {row(
              "notify-digest",
              CalendarDays,
              "Weekly activity digest",
              "A quiet recap of what happened this week.",
              false
            )}
          </SettingsCard>
        </div>
        <p className={cn(demoNoteClass, "mt-4")}>
          <Info className={demoNoteIconClass} />
          Notification preferences are saved locally in this demo.
        </p>
      </>
    );
  if (section === "security")
    return (
      <>
        <div className="mb-[26px]">
          <h2 className={sectionTitleClass}>Keep your space secure</h2>
          <p className={sectionDescriptionClass}>Manage how you access your workspace.</p>
        </div>
        <div className={stackClass}>
          {!org && <LockedFolderSettings />}
          <SettingsCard title="Sign-in" description="How you prove it’s really you.">
            <div className={rowClass}>
              <span className={rowIconClass} aria-hidden="true">
                <KeyRound />
              </span>
              <div className="min-w-0 flex-1">
                <strong className={rowTitleClass}>Password</strong>
                <p className={rowDescriptionClass}>
                  Update your password using a secure email link.
                </p>
              </div>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/forgot-password" />}
              >
                Reset password
              </Button>
            </div>
            <div className={rowClass}>
              <span className={rowIconClass} aria-hidden="true">
                <ShieldCheck />
              </span>
              <div className="min-w-0 flex-1">
                <strong className={rowTitleClass}>Two-factor authentication</strong>
                <p className={rowDescriptionClass}>Requires backend setup before enrollment.</p>
              </div>
              <Badge variant="outline">Not configured</Badge>
            </div>
            {row("login-alert", BellRing, "Sign-in alerts", "Notify me about new device sign-ins.")}
          </SettingsCard>
          <SettingsCard title="Sessions" description="Devices currently signed in to your account.">
            <div className={rowClass}>
              <span className={rowIconClass} aria-hidden="true">
                <Monitor />
              </span>
              <div className="min-w-0 flex-1">
                <strong className={rowTitleClass}>This device</strong>
                <p className={rowDescriptionClass}>Current browser session</p>
              </div>
              <Badge variant="secondary" className="gap-1.5">
                <span className={statusDotClass} aria-hidden="true" />
                Active now
              </Badge>
            </div>
          </SettingsCard>
        </div>
        <p className={cn(demoNoteClass, "mt-4")}>
          <Info className={demoNoteIconClass} />
          Security preferences shown here are a UI preview.
        </p>
      </>
    );
  if (section === "sharing" || section === "permissions")
    return (
      <>
        <div className="mb-[26px]">
          <h2 className={sectionTitleClass}>
            {section === "sharing" ? "Better, together" : "The right level of access"}
          </h2>
          <p className={sectionDescriptionClass}>Set thoughtful defaults for your workspace.</p>
        </div>
        <div className={stackClass}>
          <SettingsCard
            title="Defaults"
            description="Applied whenever files and folders are shared."
          >
            <div className={rowClass}>
              <span className={rowIconClass} aria-hidden="true">
                <UserPlus />
              </span>
              <div className="min-w-0 flex-1">
                <strong className={rowTitleClass}>Default sharing permission</strong>
                <p className={rowDescriptionClass}>Access level for new collaborators.</p>
              </div>
              <Choice
                label="Default permission"
                className="w-32 shrink-0"
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
              false
            )}
            {row(
              "external-sharing",
              Globe,
              "External collaborators",
              "Allow sharing with people outside your organization.",
              false
            )}
            {row(
              "inherit",
              FolderTree,
              "Inherit folder permissions",
              "Files inherit access from their parent folder."
            )}
          </SettingsCard>
          <SettingsCard
            title="Permission inheritance"
            description="Inherited permissions are shown in each file’s sharing dialog."
          >
            <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 px-5 py-[18px]">
              {inheritance.map(([label, Icon], i) => (
                <li key={label} className="flex items-center gap-1.5">
                  {i > 0 && (
                    <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  )}
                  <span className="inline-flex h-8 items-center gap-[7px] rounded-full border bg-[color-mix(in_srgb,var(--muted)_50%,var(--card))] px-3 text-[12.5px] font-medium">
                    <Icon aria-hidden="true" className="size-3.5 text-muted-foreground" />
                    {label}
                  </span>
                </li>
              ))}
            </ol>
          </SettingsCard>
        </div>
        <p className={cn(demoNoteClass, "mt-4")}>
          <Info className={demoNoteIconClass} />
          Sharing inside a drive is simple: everything marked shared is visible to all members;
          private items stay visible only to you.
        </p>
      </>
    );
  if (section === "danger")
    return (
      <>
        <div className="mb-[26px]">
          <h2 className={sectionTitleClass}>Danger zone</h2>
          <p className={sectionDescriptionClass}>Changes here need a little extra care.</p>
        </div>
        <SettingsCard className="border-[color-mix(in_srgb,var(--destructive)_35%,var(--border))]">
          <div className="flex items-center gap-3.5 px-5 py-[18px] max-md:flex-col max-md:items-start max-md:gap-3 max-md:px-4">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-destructive/10 text-destructive max-md:hidden [&_svg]:size-4"
              aria-hidden="true"
            >
              <RotateCcw />
            </span>
            <div className="min-w-0 flex-1">
              <strong className={rowTitleClass}>Empty the trash</strong>
              <p className={rowDescriptionClass}>
                Permanently delete everything currently in this workspace&apos;s trash.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => {
                const trashed = data.files.filter((f) => f.trashed);
                if (!trashed.length) {
                  toast.info("The trash is already empty");
                  return;
                }
                void deleteItems(trashed.map((f) => f.id)).then((result) => {
                  if (result.ok) toast.success("Trash emptied");
                  else toast.error(result.error);
                });
              }}
            >
              Empty trash
            </Button>
          </div>
        </SettingsCard>
      </>
    );
  return (
    <div className="mb-[26px]">
      <h2 className={sectionTitleClass}>Settings section not found</h2>
      <p className={sectionDescriptionClass}>Select a section from the settings menu.</p>
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
  const records: Credential[] = JSON.parse(String(data.preferences[key] || "[]"));
  const kind: DeveloperKind = tab in developerKinds ? (tab as DeveloperKind) : "keys";
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
      <div className="mb-[26px] flex items-start justify-between gap-4 max-md:flex-col max-md:gap-2.5">
        <div>
          <h2 className={sectionTitleClass}>Built to connect</h2>
          <p className={sectionDescriptionClass}>
            Connect your workspace to the tools and workflows you build.
          </p>
        </div>
        <Badge variant="outline" className="mt-1 shrink-0 gap-1.5">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
          {scopeLabel}
        </Badge>
      </div>
      <Tabs value={kind} onValueChange={(v) => void setTab(String(v))}>
        <TabsList
          variant="line"
          className="h-auto! w-full justify-start gap-5 overflow-x-auto border-b p-0 max-md:gap-3.5"
        >
          {developerKindIds.map((id) => {
            const Icon = developerKinds[id].icon;
            const count = records.filter((r) => r.kind === id).length;
            return (
              <TabsTrigger
                key={id}
                value={id}
                className="h-10 flex-none gap-[7px] px-0.5 py-0 text-[13px] after:bottom-[-1px]!"
              >
                <Icon />
                {developerKinds[id].label}
                {count > 0 && (
                  <span className="inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-muted px-[5px] text-[11px] text-muted-foreground tabular-nums">
                    {count}
                  </span>
                )}
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
              <section className="mt-5 overflow-hidden rounded-[14px] border bg-card">
                <header className="flex items-center justify-between gap-4 px-5 py-[18px] max-md:flex-col max-md:items-stretch">
                  <div>
                    <h3 className="flex items-center gap-2 text-[14px] font-semibold">
                      {info.label}
                      <Badge variant="secondary">Demo</Badge>
                    </h3>
                    <p className="mt-[3px] text-[12.5px] text-muted-foreground">
                      {info.description}
                    </p>
                  </div>
                  {items.length > 0 && (
                    <Button onClick={openCreate}>
                      <Plus />
                      Create {info.noun}
                    </Button>
                  )}
                </header>
                {items.length > 0 ? (
                  <div className={tableWrapperClass}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className={tableHeadClass}>Name</TableHead>
                          <TableHead className={tableHeadClass}>
                            {id === "webhooks" ? "Events" : "Permissions"}
                          </TableHead>
                          <TableHead className={tableHeadClass}>Created</TableHead>
                          <TableHead className={tableHeadClass}>Status</TableHead>
                          <TableHead className={tableHeadClass}>
                            <span className="sr-only">Actions</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className={tableCellClass}>
                              <span className="flex min-w-0 items-center gap-2.5">
                                <span className="grid size-[30px] shrink-0 place-items-center rounded-[8px] bg-muted text-muted-foreground [&_svg]:size-[15px]">
                                  <Icon />
                                </span>
                                <span className="min-w-0">
                                  <strong className="block font-medium">{r.name}</strong>
                                  {r.url && (
                                    <small
                                      title={r.url}
                                      className="block max-w-[280px] truncate font-mono text-[11.5px] text-muted-foreground"
                                    >
                                      {r.url}
                                    </small>
                                  )}
                                </span>
                              </span>
                            </TableCell>
                            <TableCell className={tableCellClass}>
                              <Badge variant="outline">{r.permission}</Badge>
                            </TableCell>
                            <TableCell className={tableCellClass}>
                              {formatMediumDate(r.date)}
                            </TableCell>
                            <TableCell className={tableCellClass}>
                              <Badge variant="secondary">Demo</Badge>
                            </TableCell>
                            <TableCell className={cn(tableCellClass, "text-right")}>
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
                  <Empty className={tableEmptyClass}>
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
                <section className="mt-4 rounded-[14px] border px-5 py-[18px]">
                  <h3 className="text-[13px] font-medium">Available events</h3>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    Pick any of these when you add an endpoint.
                  </p>
                  <ul className="mt-3.5 flex list-none flex-wrap gap-2 p-0">
                    {webhookEvents.map((e) => (
                      <li key={e}>
                        <code className="inline-block rounded-[7px] border bg-[color-mix(in_srgb,var(--muted)_60%,var(--card))] px-[9px] py-[5px] text-[11.5px]">
                          {e}
                        </code>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <p className={cn(demoNoteClass, "mt-4")}>
                <Info className={demoNoteIconClass} />
                Demo records only. No usable credentials are generated and endpoints are never
                called.
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
                  placeholder={kind === "webhooks" ? "Slack notifier" : "My integration"}
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
                <FieldLabel>{kind === "webhooks" ? "Events" : "Permissions"}</FieldLabel>
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
            <p className={cn(demoNoteClass, "mt-4")}>
              No usable credentials are generated. Connect your backend to issue and manage secrets
              securely.
            </p>
            <DialogFooter className="mt-6">
              <Button type="button" variant="ghost" onClick={() => setModal(false)}>
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
  const { data } = useWorkspace();
  const [search, setSearch] = useQueryState("search", { defaultValue: "" });
  const [action, setAction] = useQueryState("action", { defaultValue: "all" });
  // Real audit trail derived from the drive: what changed and who owns it.
  const events = data.files
    .filter(
      (f) =>
        (action === "all" || action === auditAction(f)) &&
        f.name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
    .slice(0, 50)
    .map((f) => ({
      id: f.id,
      user: f.owner,
      action: auditAction(f),
      resource: f.name,
      date: f.modified,
    }));
  return (
    <>
      <div className="mb-[26px]">
        <h2 className={sectionTitleClass}>Workspace audit log</h2>
        <p className={sectionDescriptionClass}>A clear record of what happened, and when.</p>
      </div>
      <section className={cardClass}>
        <div className="flex items-center gap-2 px-4 py-3.5 max-md:flex-wrap">
          <InputGroup className="w-[260px] max-md:w-full">
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
              ...Array.from(new Set(data.files.map((f) => auditAction(f)))).map((a) => ({
                label: a,
                value: a,
              })),
            ]}
          />
          <span className="ml-auto text-[12px] text-muted-foreground tabular-nums">
            {events.length} {events.length === 1 ? "event" : "events"}
          </span>
        </div>
        {events.length > 0 ? (
          <div className={tableWrapperClass}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={tableHeadClass}>User</TableHead>
                  <TableHead className={tableHeadClass}>Action</TableHead>
                  <TableHead className={tableHeadClass}>Resource</TableHead>
                  <TableHead className={tableHeadClass}>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className={tableCellClass}>
                      <span className="flex min-w-0 items-center gap-2.5">
                        <PersonAvatar name={e.user} />
                        <strong className="block font-medium">{e.user}</strong>
                      </span>
                    </TableCell>
                    <TableCell className={tableCellClass}>
                      <Badge variant="outline" className="font-mono">
                        {e.action}
                      </Badge>
                    </TableCell>
                    <TableCell className={tableCellClass}>{e.resource}</TableCell>
                    <TableCell className={cn(tableCellClass, "text-muted-foreground")}>
                      <time dateTime={e.date}>{formatDateTime(e.date)}</time>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Empty className={tableEmptyClass}>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ScrollText />
              </EmptyMedia>
              <EmptyTitle>No matching events</EmptyTitle>
              <EmptyDescription>Try a different resource name or action.</EmptyDescription>
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
      <p className={cn(demoNoteClass, "mt-4")}>
        <Info className={demoNoteIconClass} />
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
    <section className={cn(cardClass, className)} aria-labelledby={title ? id : undefined}>
      {title && (
        <header className={cardHeaderClass}>
          <h3 id={id} className={cardTitleClass}>
            {title}
          </h3>
          {description && <p className={cardDescriptionClass}>{description}</p>}
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
