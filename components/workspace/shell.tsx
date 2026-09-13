"use client";

import {
  ArrowRight,
  FileUp,
  FolderPlus,
  FolderUp,
  Moon,
  Plus,
  Search,
  Sun,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppSidebar } from "@/components/app-sidebar";
import { FilePreview } from "@/components/preview/file-preview";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { UploadProvider, useUpload } from "@/components/upload/upload-provider";
import { createFolder as createDriveFolder, switchSpace } from "@/lib/drive/items";
import { createOrganizationAction, getOrganizations, inviteMembers } from "@/lib/drive/org";
import { PersonAvatar } from "./common";
import { NotificationsMenu } from "./notifications-menu";
import { useWorkspaceRoute } from "./route";
import { useWorkspace, WorkspaceProvider } from "./store";

export function WorkspaceShell({
  children,
  user,
  signOutAction,
  defaultOpen,
  remote = false,
}: {
  children: ReactNode;
  user: { name: string; email: string };
  signOutAction: () => Promise<void>;
  defaultOpen: boolean;
  // Serve the personal workspace from the database (signed-in routes).
  remote?: boolean;
}) {
  return (
    <WorkspaceProvider user={user} remote={remote}>
      <SidebarProvider defaultOpen={defaultOpen}>
        <UploadProvider>
          <ShellContent signOutAction={signOutAction}>{children}</ShellContent>
        </UploadProvider>
      </SidebarProvider>
      <Toaster />
    </WorkspaceProvider>
  );
}
function ShellContent({
  children,
  signOutAction,
}: {
  children: ReactNode;
  signOutAction: () => Promise<void>;
}) {
  const { data, drive } = useWorkspace();
  const { org, base, page, team, prefix } = useWorkspaceRoute();
  const router = useRouter();
  const { pick } = useUpload();
  const [folder] = useQueryState("folder", { history: "push" });
  const [search, setSearch] = useQueryState("search", { defaultValue: "" });
  const [, setPreview] = useQueryState("preview", { history: "push" });
  const [command, setCommand] = useState(false);
  const [modal, setModal] = useState<"folder" | "organization" | null>(null);
  const [name, setName] = useState("");
  const [privateFolder, setPrivateFolder] = useState(false);
  const [step, setStep] = useState(1);
  const [emails, setEmails] = useState("");
  const [teamName, setTeamName] = useState("Engineering");
  const [creating, setCreating] = useState(false);
  const organization = data.organizations.find((o) => o.slug === org || o.id === org);
  const currentFolder = data.files.find((f) => f.id === folder);
  const teamLabel = team ? data.teams.find((t) => t.id === team)?.name : undefined;
  useEffect(() => {
    function keys(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommand((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "u") {
        e.preventDefault();
        pick();
      }
    }
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [pick]);
  const parentPrivate = currentFolder?.visibility === "private";
  async function createFolder() {
    if (!name.trim()) return;
    const result = await drive.run(
      createDriveFolder({
        name: name.trim(),
        parentId: folder,
        private: privateFolder,
        locked: page === "locked",
      }),
      "Folder created"
    );
    if (!result.ok) return;
    setModal(null);
    setName("");
    setPrivateFolder(false);
  }
  async function createOrganization() {
    if (creating) return;
    setCreating(true);
    try {
      const result = await createOrganizationAction({
        name: name.trim(),
        teamName: teamName.trim() || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Open the new organization's drive (switch the server-side space).
      const orgs = await getOrganizations();
      const target = orgs.ok ? orgs.data.find((o) => o.slug === result.data.slug) : undefined;
      if (target && target.id !== drive.listing?.workspace.id) await switchSpace(target.id);
      // The wizard's optional team emails become real invitations.
      const list = emails.split(/[;,\s]+/).filter(Boolean);
      if (list.length) await inviteMembers(result.data.slug, { emails, role: "member" });
      await drive.reload();
      setModal(null);
      setStep(1);
      setName("");
      setEmails("");
      router.push(`/org/${result.data.slug}/drive`);
      toast.success("Organization created");
    } finally {
      setCreating(false);
    }
  }
  return (
    <>
      <AppSidebar
        signOutAction={signOutAction}
        onOrganization={() => {
          setName("");
          setModal("organization");
        }}
      />
      <SidebarInset className="drive-main">
        <header className="top-navigation">
          <div className="top-breadcrumb">
            <SidebarTrigger className="mobile-sidebar-trigger" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <button onClick={() => router.push(org ? base : `${prefix}/drive`)}>
                    {organization?.name || "Personal workspace"}
                  </button>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    {teamLabel ||
                      {
                        drive: org ? "Files" : "My Drive",
                        overview: "Overview",
                        shared: "Shared with me",
                        locked: "Locked folder",
                      }[page] ||
                      page[0].toUpperCase() + page.slice(1)}
                  </BreadcrumbPage>
                </BreadcrumbItem>
                {currentFolder && (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{currentFolder.name}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="top-actions">
            <button className="global-search" onClick={() => setCommand(true)}>
              <Search className="size-4" />
              <span>Search anything...</span>
              <kbd>⌘ K</kbd>
            </button>
            <NotificationsMenu />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle light and dark theme"
              onClick={() => {
                const dark = document.documentElement.classList.contains("dark");
                document.documentElement.classList.toggle("dark", !dark);
                try {
                  localStorage.setItem("drive-theme", dark ? "light" : "dark");
                } catch {
                  // Preferences are a nicety; ignore storage failures.
                }
              }}
            >
              <Sun className="dark:hidden" />
              <Moon className="hidden dark:block" />
            </Button>
          </div>
        </header>
        <div className="workspace-content">{children}</div>
      </SidebarInset>
      <div className="global-file-actions" hidden>
        <Button onClick={() => pick()}>Upload</Button>
      </div>
      <button className="mobile-upload" aria-label="Upload files" onClick={() => pick()}>
        <Plus />
      </button>
      <Dialog open={command} onOpenChange={setCommand}>
        <DialogContent className="p-0 sm:max-w-xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Search workspace</DialogTitle>
            <DialogDescription>Search files, folders, people, and teams.</DialogDescription>
          </DialogHeader>
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search files, folders, people, teams…"
            />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              {["Files", "Folders"].map((group) => (
                <CommandGroup heading={group} key={group}>
                  {data.files
                    .filter(
                      (f) =>
                        !f.trashed &&
                        !f.locked &&
                        (group === "Folders" ? f.kind === "folder" : f.kind !== "folder") &&
                        `${f.name} ${f.owner} ${f.tags?.join(" ")}`
                          .toLowerCase()
                          .includes(search.toLowerCase())
                    )
                    .map((f) => (
                      <CommandItem
                        key={f.id}
                        onSelect={() => {
                          setCommand(false);
                          if (f.kind === "folder") {
                            router.push(`${base}/drive?folder=${f.id}`);
                          } else {
                            void setPreview(f.id);
                          }
                        }}
                      >
                        <FileUp />
                        <span>{f.name}</span>
                        <small className="ml-auto text-muted-foreground">{f.kind}</small>
                      </CommandItem>
                    ))}
                </CommandGroup>
              ))}
              {org && (
                <>
                  <CommandGroup heading="Teams">
                    {data.teams
                      .filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
                      .map((t) => (
                        <CommandItem
                          key={t.id}
                          onSelect={() => {
                            setCommand(false);
                            router.push(`${base}/teams/${t.id}`);
                          }}
                        >
                          <FolderPlus />
                          {t.name}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                  <CommandGroup heading="Organizations">
                    {data.organizations
                      .filter((o) => o.name.toLowerCase().includes(search.toLowerCase()))
                      .map((o) => (
                        <CommandItem
                          key={o.id}
                          onSelect={() => {
                            setCommand(false);
                            router.push(`/org/${o.slug}/drive`);
                          }}
                        >
                          <PersonAvatar name={o.name} />
                          {o.name}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!modal}
        onOpenChange={(open) => {
          if (!open) {
            setModal(null);
            setStep(1);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {modal === "folder" ? "New folder" : "A space to work together"}
            </DialogTitle>
            <DialogDescription>
              {modal === "folder"
                ? "Give your ideas a home."
                : `Step ${step} of 3 · Create your organization`}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (modal === "folder") void createFolder();
              else if (step < 3) setStep(step + 1);
              else createOrganization();
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="create-name">
                  {modal === "folder"
                    ? "Folder name"
                    : step === 1
                      ? "Organization name"
                      : step === 2
                        ? "Team emails (optional)"
                        : "First team name"}
                </FieldLabel>
                <Input
                  id="create-name"
                  autoFocus
                  required={step !== 2}
                  value={modal === "folder" || step === 1 ? name : step === 2 ? emails : teamName}
                  onChange={(e) =>
                    modal === "folder" || step === 1
                      ? setName(e.target.value)
                      : step === 2
                        ? setEmails(e.target.value)
                        : setTeamName(e.target.value)
                  }
                  placeholder={
                    modal === "folder"
                      ? "Untitled folder"
                      : step === 1
                        ? "Acme Inc."
                        : step === 2
                          ? "you@example.com"
                          : "Engineering"
                  }
                />
                {modal === "organization" && step === 1 && (
                  <small className="text-muted-foreground">
                    drive.app/org/
                    {name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "your-organization"}
                  </small>
                )}
                {step === 2 && (
                  <small className="text-muted-foreground">
                    You can invite people right after creating the organization.
                  </small>
                )}
              </Field>
              {/* Everything in the Locked folder is private already. */}
              {modal === "folder" && drive.active && page !== "locked" && (
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor="create-private">Private folder</FieldLabel>
                    <FieldDescription>
                      {parentPrivate
                        ? "Everything inside a private folder is private."
                        : "Only you can see it and what's inside."}
                    </FieldDescription>
                  </FieldContent>
                  <Switch
                    id="create-private"
                    checked={privateFolder || parentPrivate}
                    disabled={parentPrivate}
                    onCheckedChange={setPrivateFolder}
                  />
                </Field>
              )}
            </FieldGroup>
            <DialogFooter className="mt-6">
              <Button
                variant="outline"
                type="button"
                onClick={() => (step > 1 ? setStep(step - 1) : setModal(null))}
              >
                {step > 1 ? "Back" : "Cancel"}
              </Button>
              <Button type="submit">
                {modal === "folder"
                  ? "Create folder"
                  : step === 3
                    ? "Create organization"
                    : "Continue"}
                <ArrowRight />
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <FilePreview />
      <NewActionBridge
        onNewFolder={() => {
          setName("");
          setModal("folder");
        }}
      />
    </>
  );
}
function NewActionBridge({ onNewFolder }: { onNewFolder: () => void }) {
  useEffect(() => {
    window.addEventListener("drive:new-folder", onNewFolder);
    return () => window.removeEventListener("drive:new-folder", onNewFolder);
  }, [onNewFolder]);
  return null;
}
export function FileActions() {
  const { pick } = useUpload();
  return (
    <div className="flex gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="lg" />}>
          <Plus />
          New
          <ChevronDownSmall />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => window.dispatchEvent(new Event("drive:new-folder"))}>
              <FolderPlus />
              New folder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => pick()}>
              <FileUp />
              Upload files
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => pick(true)}>
              <FolderUp />
              Upload folder
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button size="lg" onClick={() => pick()}>
        <Upload data-icon="inline-start" />
        Upload files
      </Button>
    </div>
  );
}
function ChevronDownSmall() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
