"use client";

import {
  Check,
  ChevronsUpDown,
  Clock3,
  Database,
  FolderLock,
  HardDrive,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  Plus,
  Settings2,
  Shapes,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { PersonAvatar } from "@/components/workspace/common";
import { useWorkspaceRoute } from "@/components/workspace/route";
import { useWorkspace } from "@/components/workspace/store";
import { switchSpace } from "@/lib/drive/items";
import { cn } from "@/lib/utils";

// `.drive-sidebar` overrides only reached the desktop container (the mobile Sheet drops
// className), hence `md:`. The primitive's collapsed `size-8!`/`p-2!` still win when collapsed.
const menuButtonClass =
  "md:h-10 md:gap-3 md:rounded-[7px] md:px-3 md:py-0 md:text-[13px] md:[&>svg]:size-[17px] md:[&>svg]:[stroke-width:1.7]";
const teamDotColor: Record<string, string> = {
  purple: "bg-folder-purple",
  amber: "bg-folder-amber",
};

export function AppSidebar({
  signOutAction,
  onOrganization,
}: {
  signOutAction: () => Promise<void>;
  onOrganization: () => void;
}) {
  const { data, user, drive } = useWorkspace();
  const { org, base, page, team, prefix } = useWorkspaceRoute();
  const { setOpenMobile, toggleSidebar } = useSidebar();
  const router = useRouter();
  const organization = data.organizations.find((o) => o.slug === org || o.id === org);
  const current = drive.listing?.workspace;
  // Files other people shared into the open drive.
  const sharedCount = drive.listing
    ? drive.listing.items.filter(
        (i) => i.visibility === "shared" && i.createdById !== current?.userId && !i.trashedAt
      ).length
    : 0;
  // A family member's drive you joined, when that's the one open.
  const familyDrive = !org && current && !current.own ? current.name : undefined;
  // Your own drive's chosen name, when that's the one open.
  const ownDrive = !org && current?.own ? current.name : undefined;
  async function openSpace(id: string) {
    if (id !== current?.id) {
      const result = await drive.run(switchSpace(id));
      if (!result.ok) return;
    }
    navigate(`${prefix}/drive`);
  }
  // Open an organization: switch the server-side workspace cookie, then route.
  async function openOrg(slug: string) {
    const target = data.organizations.find((o) => o.slug === slug);
    if (target && target.id !== current?.id) {
      const result = await drive.run(switchSpace(target.id));
      if (!result.ok) return;
    }
    navigate(`${prefix}/org/${slug}/drive`);
  }
  const links = [
    ...(org ? [{ title: "Overview", icon: LayoutDashboard, path: "" }] : []),
    { title: org ? "Files" : "My Drive", icon: HardDrive, path: "/drive" },
    { title: "Recent", icon: Clock3, path: "/recent" },
    { title: "Starred", icon: Star, path: "/starred" },
    { title: org ? "Shared" : "Shared with me", icon: Users, path: "/shared" },
    // Signed-in personal drives only; the demo has no PIN to check.
    ...(drive.active ? [{ title: "Locked folder", icon: FolderLock, path: "/locked" }] : []),
    { title: "Trash", icon: Trash2, path: "/trash" },
  ];
  const navigate = (url: string) => {
    router.push(url);
    setOpenMobile(false);
  };
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="group-data-[collapsible=icon]:px-[7px] group-data-[collapsible=icon]:py-5 md:gap-[27px] md:px-[19px] md:pt-[26px] md:pb-4">
        <div className="flex items-center justify-between">
          <Link href={`${prefix}/drive`} className="inline-flex items-center gap-2.5">
            <span className="grid size-[33px] place-items-center rounded-[9px] bg-primary text-primary-foreground">
              <HardDrive className="size-[22px] [stroke-width:1.7]" />
            </span>
            <span className="text-[28px] font-[650] tracking-[-1.6px] text-foreground group-data-[collapsible=icon]:hidden">
              drive<span className="text-primary">.</span>
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="opacity-55 group-data-[collapsible=icon]:hidden"
            aria-label="Collapse sidebar"
            onClick={toggleSidebar}
          >
            <PanelLeftClose />
          </Button>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="group-data-[collapsible=icon]:p-2 md:px-[18px] md:pb-[17px]">
          <SidebarGroupLabel className="md:pl-3 md:text-[10px] md:font-semibold md:tracking-[0.12em] md:text-muted-foreground">
            WORKSPACE
          </SidebarGroupLabel>
          <SidebarMenu className="md:gap-[5px]">
            {links.map((l) => (
              <SidebarMenuItem key={l.title}>
                <SidebarMenuButton
                  className={menuButtonClass}
                  render={<Link href={`${base}${l.path || ""}` || "/drive"} />}
                  tooltip={l.title}
                  isActive={
                    !team &&
                    (page === (l.path.slice(1) || "overview") ||
                      (page === "drive" && l.path === "/drive"))
                  }
                  onClick={() => setOpenMobile(false)}
                >
                  <l.icon />
                  <span>{l.title}</span>
                  {l.path === "/shared" && sharedCount > 0 && (
                    <span className="ml-auto rounded-[4px] border bg-background px-[5px] text-[10px] leading-4">
                      {sharedCount}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        {org && (
          <SidebarGroup className="group-data-[collapsible=icon]:p-2 md:px-[18px] md:pb-[17px]">
            <SidebarGroupLabel className="md:pl-3 md:text-[10px] md:font-semibold md:tracking-[0.12em] md:text-muted-foreground">
              COLLABORATION
            </SidebarGroupLabel>
            <SidebarMenu className="md:gap-[5px]">
              <SidebarMenuItem>
                <SidebarMenuButton
                  className={menuButtonClass}
                  render={<Link href={`${base}/teams`} />}
                  isActive={page === "teams"}
                  tooltip="Teams"
                >
                  <Shapes />
                  <span>Teams</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  className={menuButtonClass}
                  render={<Link href={`${base}/members`} />}
                  isActive={page === "members"}
                  tooltip="Members"
                >
                  <Users />
                  <span>Members</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {data.teams.map((t) => (
                <SidebarMenuItem key={t.id}>
                  <SidebarMenuButton
                    className={menuButtonClass}
                    render={<Link href={`${base}/teams/${t.id}`} />}
                    tooltip={t.name}
                  >
                    <span
                      className={cn(
                        "mx-[5px] size-1.5 rounded-full",
                        teamDotColor[t.color ?? ""] ?? "bg-folder-green"
                      )}
                    />
                    <span>{t.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
        <SidebarGroup className="mt-auto group-data-[collapsible=icon]:p-2 md:px-[18px] md:pb-[17px]">
          <SidebarMenu className="md:gap-[5px]">
            {[
              { name: "Storage", icon: Database, path: "/storage" },
              { name: "Settings", icon: Settings2, path: "/settings" },
            ].map((l) => (
              <SidebarMenuItem key={l.name}>
                <SidebarMenuButton
                  className={menuButtonClass}
                  render={<Link href={`${base}${l.path}`} />}
                  tooltip={l.name}
                  isActive={page === l.path.slice(1)}
                >
                  <l.icon />
                  <span>{l.name}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="md:gap-[18px] md:px-5 md:pt-0 md:pb-3.5">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-[9px] border-t pt-[17px] text-left group-data-[collapsible=icon]:hidden">
            <PersonAvatar name={organization?.name || familyDrive || user.name} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <strong className="truncate text-[12px] font-[550]">
                {organization?.name || familyDrive || ownDrive || user.name}
              </strong>
              <small className="truncate text-[10px] text-muted-foreground md:text-[11px]">
                {org
                  ? "Organization workspace"
                  : familyDrive
                    ? "Shared drive"
                    : "Personal workspace"}
              </small>
            </span>
            <ChevronsUpDown className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64" align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
              {drive.listing ? (
                // Organizations have their own group below.
                drive.listing.spaces
                  .filter((s) => s.kind === "personal")
                  .map((s) => (
                    <DropdownMenuItem key={s.id} onClick={() => void openSpace(s.id)}>
                      <PersonAvatar name={s.own ? user.name : s.name} />
                      <span className="flex flex-col">
                        {s.name}
                        <small className="text-muted-foreground">
                          {s.own ? "Personal workspace" : "Shared with you"}
                        </small>
                      </span>
                      {!org && s.id === current?.id && <Check className="ml-auto" />}
                    </DropdownMenuItem>
                  ))
              ) : (
                <DropdownMenuItem onClick={() => navigate(`${prefix}/drive`)}>
                  <PersonAvatar name={user.name} />
                  <span>Personal workspace</span>
                  {!org && <Check className="ml-auto" />}
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Organizations</DropdownMenuLabel>
              {data.organizations.map((o) => (
                <DropdownMenuItem key={o.id} onClick={() => void openOrg(o.slug)}>
                  <PersonAvatar name={o.name} />
                  <span className="flex flex-col">
                    {o.name}
                    <small className="text-muted-foreground">{o.members} members</small>
                  </span>
                  {o.slug === org && <Check className="ml-auto" />}
                </DropdownMenuItem>
              ))}
              {!data.organizations.length && (
                <DropdownMenuItem disabled>No organizations yet</DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={onOrganization}>
                <Plus />
                Create organization
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem variant="destructive" onClick={() => void signOutAction()}>
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
