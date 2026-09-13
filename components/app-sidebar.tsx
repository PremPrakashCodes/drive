"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  HardDrive,
  Clock3,
  Star,
  Users,
  Trash2,
  Database,
  Settings2,
  ChevronsUpDown,
  Plus,
  Check,
  LayoutDashboard,
  Shapes,
  FolderLock,
  LogOut,
  PanelLeftClose,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/components/workspace/common";
import { useWorkspace } from "@/components/workspace/store";
import { useWorkspaceRoute } from "@/components/workspace/route";
import { switchSpace } from "@/lib/drive/items";
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
  const organization = data.organizations.find((o) => o.id === org);
  const current = drive.listing?.workspace;
  // A family member's drive you joined, when that's the one open.
  const familyDrive = !org && current && !current.own ? current.name : undefined;
  async function openSpace(id: string) {
    if (id !== current?.id) {
      const result = await drive.run(switchSpace(id));
      if (!result.ok) return;
    }
    navigate(`${prefix}/drive`);
  }
  const links = [
    ...(org ? [{ title: "Overview", icon: LayoutDashboard, path: "" }] : []),
    { title: org ? "Files" : "My Drive", icon: HardDrive, path: "/drive" },
    { title: "Recent", icon: Clock3, path: "/recent" },
    { title: "Starred", icon: Star, path: "/starred" },
    { title: org ? "Shared" : "Shared with me", icon: Users, path: "/shared" },
    // Signed-in personal drives only; the demo has no PIN to check.
    ...(drive.active
      ? [{ title: "Locked folder", icon: FolderLock, path: "/locked" }]
      : []),
    { title: "Trash", icon: Trash2, path: "/trash" },
  ];
  const navigate = (url: string) => {
    router.push(url);
    setOpenMobile(false);
  };
  return (
    <Sidebar collapsible="icon" className="drive-sidebar">
      <SidebarHeader>
        <div className="brand-row">
          <Link href={`${prefix}/drive`} className="brand">
            <span className="brand-mark">
              <HardDrive />
            </span>
            <span className="brand-word">
              drive<span>.</span>
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="sidebar-collapse"
            aria-label="Collapse sidebar"
            onClick={toggleSidebar}
          >
            <PanelLeftClose />
          </Button>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>WORKSPACE</SidebarGroupLabel>
          <SidebarMenu>
            {links.map((l) => (
              <SidebarMenuItem key={l.title}>
                <SidebarMenuButton
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
                  {l.path === "/shared" && <span className="nav-count">4</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        {org && (
          <SidebarGroup>
            <SidebarGroupLabel>COLLABORATION</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
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
                  render={<Link href={`${base}/members`} />}
                  isActive={page === "members"}
                  tooltip="Members"
                >
                  <Users />
                  <span>Members</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {data.teams
                .filter((t) => t.workspace === org)
                .map((t) => (
                  <SidebarMenuItem key={t.id}>
                    <SidebarMenuButton
                      render={<Link href={`${base}/teams/${t.id}`} />}
                      tooltip={t.name}
                    >
                      <span className={`team-dot ${t.color}`} />
                      <span>{t.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
        <SidebarGroup className="mt-auto">
          <SidebarMenu>
            {[
              { name: "Storage", icon: Database, path: "/storage" },
              { name: "Settings", icon: Settings2, path: "/settings" },
            ].map((l) => (
              <SidebarMenuItem key={l.name}>
                <SidebarMenuButton
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
      <SidebarFooter>
        <DropdownMenu>
          <DropdownMenuTrigger className="profile-button">
            <PersonAvatar
              name={organization?.name || familyDrive || user.name}
            />
            <span className="workspace-label">
              <strong>{organization?.name || familyDrive || user.name}</strong>
              <small>
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
                drive.listing.spaces.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => void openSpace(s.id)}
                  >
                    <PersonAvatar name={s.own ? user.name : s.name} />
                    <span className="flex flex-col">
                      {s.own ? "My drive" : s.name}
                      <small className="text-muted-foreground">
                        {s.own ? "Personal workspace" : "Shared with you"}
                      </small>
                    </span>
                    {!org && s.id === current?.id && (
                      <Check className="ml-auto" />
                    )}
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
                <DropdownMenuItem
                  key={o.id}
                  onClick={() => navigate(`${prefix}/org/${o.id}`)}
                >
                  <PersonAvatar name={o.name} />
                  <span className="flex flex-col">
                    {o.name}
                    <small className="text-muted-foreground">
                      {o.members} members
                    </small>
                  </span>
                  {o.id === org && <Check className="ml-auto" />}
                </DropdownMenuItem>
              ))}
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
              <DropdownMenuItem
                variant="destructive"
                onClick={() => void signOutAction()}
              >
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
