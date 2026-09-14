"use client";

import { Moon, Search, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationsMenu } from "@/components/workspace/notifications-menu";
import { useWorkspaceRoute } from "@/components/workspace/route";
import { findOrganization, useWorkspace } from "@/components/workspace/store";

// The workspace header: where you are, search, notifications and the theme toggle.
export function ShellHeader({ onSearch }: { onSearch: () => void }) {
  const { data } = useWorkspace();
  const { org, base, page, team } = useWorkspaceRoute();
  const router = useRouter();
  const [folder] = useQueryState("folder", { history: "push" });
  const organization = findOrganization(data.organizations, org);
  const currentFolder = data.files.find((f) => f.id === folder);
  const teamLabel = team ? data.teams.find((t) => t.id === team)?.name : undefined;
  return (
    <header className="flex h-19 shrink-0 items-center justify-between gap-6 border-b px-9.5 max-[1200px]:px-6.25 max-md:h-16 max-md:gap-2 max-md:px-4.25 max-md:[&_button]:min-h-9">
      <div className="flex items-center gap-2.5">
        <SidebarTrigger className="hidden max-md:inline-flex" />
        <Breadcrumb>
          <BreadcrumbList className="gap-3 text-[12px] max-md:gap-1.25 max-md:text-[10px]">
            <BreadcrumbItem className="max-md:hidden">
              <button onClick={() => router.push(org ? base : "/drive")}>
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
      <div className="flex items-center gap-3.75 max-[1000px]:gap-2 max-md:gap-0.75">
        <button
          className="mr-3 flex items-center gap-2.25 text-[11px] text-muted-foreground max-[1200px]:mr-0 md:text-[12px]"
          onClick={onSearch}
        >
          <Search className="size-4" />
          <span className="max-[1200px]:hidden">Search anything...</span>
          <kbd className="ml-5 rounded-lg border px-1.25 py-0.5 text-[9px] max-[1200px]:ml-0 max-md:hidden">
            ⌘ K
          </kbd>
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
  );
}
