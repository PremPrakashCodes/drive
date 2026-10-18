"use client";

import { Plus } from "lucide-react";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { FilePreview } from "@/components/preview/file-preview";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { UploadProvider, useUpload } from "@/components/upload/upload-provider";
import { useAppDispatch, useAppSelector } from "@/store";
import { commandOpenChanged, commandOpenToggled, selectCommandOpen } from "@/store/slices/app";
import { CommandPalette } from "./shell/command-palette";
import { ShellHeader } from "./shell/header";
import { NewFolderDialog } from "./shell/new-folder-dialog";
import { WorkspaceProvider } from "./store";
import { useWorkspaceTheme } from "./use-workspace-theme";

// Load the organization wizard only after its first open; keep it mounted for exit animations.
const CreateOrganizationDialog = dynamic(() =>
  import("./shell/create-organization-dialog").then((m) => m.CreateOrganizationDialog)
);

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
  useWorkspaceTheme();
  const { pick } = useUpload();
  const dispatch = useAppDispatch();
  const command = useAppSelector(selectCommandOpen);
  useEffect(() => {
    function keys(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        dispatch(commandOpenToggled());
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "u") {
        e.preventDefault();
        pick();
      }
    }
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [dispatch, pick]);
  // A new `key` per open remounts the wizard, so each run starts fresh.
  const [organizationDialog, setOrganizationDialog] = useState({ open: false, key: 0 });
  return (
    <>
      <AppSidebar
        signOutAction={signOutAction}
        onOrganization={() => setOrganizationDialog((d) => ({ open: true, key: d.key + 1 }))}
      />
      <SidebarInset className="min-h-svh min-w-0 bg-background">
        <ShellHeader onSearch={() => dispatch(commandOpenChanged(true))} />
        <div className="min-w-0 flex-1 px-9.5 pt-8.75 pb-6 has-data-selection-bar:pb-26! max-[1200px]:px-6.25 max-[1200px]:py-7 max-md:px-5 max-md:py-6.25 max-xs:px-3.5 max-xs:py-5 min-[1600px]:mx-auto min-[1600px]:w-full min-[1600px]:max-w-[1550px] min-[1600px]:px-12.5 min-[1600px]:py-10.5">
          {children}
        </div>
      </SidebarInset>
      <button
        className="hidden max-md:fixed max-md:right-5.25 max-md:bottom-5.75 max-md:grid max-md:size-13 max-md:place-items-center max-md:rounded-[16px] max-md:bg-primary [body:has([data-selection-bar])_&]:hidden"
        aria-label="Upload files"
        onClick={() => pick()}
      >
        <Plus />
      </button>
      <CommandPalette open={command} onOpenChange={(open) => dispatch(commandOpenChanged(open))} />
      <NewFolderDialog />
      {organizationDialog.key > 0 && (
        <CreateOrganizationDialog
          key={organizationDialog.key}
          open={organizationDialog.open}
          onOpenChange={(open) => setOrganizationDialog((d) => ({ ...d, open }))}
        />
      )}
      <FilePreview />
    </>
  );
}
