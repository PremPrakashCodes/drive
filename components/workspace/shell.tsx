"use client";

import { ChevronDown, FileUp, FolderPlus, FolderUp, Plus, Upload } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { FilePreview } from "@/components/preview/file-preview";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { UploadProvider, useUpload } from "@/components/upload/upload-provider";
import { CommandPalette } from "./shell/command-palette";
import { CreateOrganizationDialog } from "./shell/create-organization-dialog";
import { ShellHeader } from "./shell/header";
import { NewFolderDialog } from "./shell/new-folder-dialog";
import { WorkspaceProvider } from "./store";

export function WorkspaceShell({
  children,
  user,
  signOutAction,
  defaultOpen,
}: {
  children: ReactNode;
  user: { name: string; email: string };
  signOutAction: () => Promise<void>;
  defaultOpen: boolean;
}) {
  return (
    <WorkspaceProvider user={user}>
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
  const { pick } = useUpload();
  const [command, setCommand] = useState(false);
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
  // A new `key` per open remounts the wizard, so each run starts fresh.
  const [organizationDialog, setOrganizationDialog] = useState({ open: false, key: 0 });
  return (
    <>
      <AppSidebar
        signOutAction={signOutAction}
        onOrganization={() => setOrganizationDialog((d) => ({ open: true, key: d.key + 1 }))}
      />
      <SidebarInset className="min-h-svh min-w-0 bg-background">
        <ShellHeader onSearch={() => setCommand(true)} />
        <div className="min-w-0 flex-1 px-[38px] pt-[35px] pb-6 has-[[data-selection-bar]]:pb-[104px]! max-[1200px]:px-[25px] max-[1200px]:py-7 max-md:px-5 max-md:py-[25px] max-xs:px-3.5 max-xs:py-5 min-[1600px]:mx-auto min-[1600px]:w-full min-[1600px]:max-w-[1550px] min-[1600px]:px-[50px] min-[1600px]:py-[42px]">
          {children}
        </div>
      </SidebarInset>
      <button
        className="hidden max-md:fixed max-md:right-[21px] max-md:bottom-[23px] max-md:grid max-md:size-[52px] max-md:place-items-center max-md:rounded-[16px] max-md:bg-primary [body:has([data-selection-bar])_&]:hidden"
        aria-label="Upload files"
        onClick={() => pick()}
      >
        <Plus />
      </button>
      <CommandPalette open={command} onOpenChange={setCommand} />
      <NewFolderDialog />
      <CreateOrganizationDialog
        key={organizationDialog.key}
        open={organizationDialog.open}
        onOpenChange={(open) => setOrganizationDialog((d) => ({ ...d, open }))}
      />
      <FilePreview />
    </>
  );
}
export function FileActions() {
  const { pick } = useUpload();
  return (
    <div className="flex gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="lg" />}>
          <Plus />
          New
          <ChevronDown />
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
