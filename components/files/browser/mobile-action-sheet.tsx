"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { FileBrowserState } from "./use-file-browser";

// The bottom sheet a file's "…" button opens on mobile.
export function MobileActionSheet({
  browser: { mobileFile, setMobileFile, screen, action },
}: {
  browser: FileBrowserState;
}) {
  return (
    <Sheet
      open={!!mobileFile}
      onOpenChange={(open) => {
        if (!open) setMobileFile(null);
      }}
    >
      <SheetContent side="bottom" className="max-h-[85svh]">
        <SheetHeader>
          <SheetTitle>{mobileFile?.name}</SheetTitle>
          <SheetDescription>Choose an action for this file.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col overflow-y-auto px-5 pb-[25px]">
          {(screen === "locked"
            ? [
                ["preview", "Preview"],
                ["download", "Download"],
                ["rename", "Rename"],
                ["move", "Move"],
                ["unlock", "Move out of Locked folder"],
                ["info", "File information"],
                ["permanent", "Delete permanently"],
              ]
            : screen === "trash"
              ? [
                  ["restore", "Restore"],
                  ["permanent", "Delete permanently"],
                ]
              : [
                  ["preview", "Preview"],
                  ["download", "Download"],
                  ["share", "Share"],
                  ["rename", "Rename"],
                  ["move", "Move"],
                  ["copy", "Copy"],
                  ["star", "Toggle star"],
                  ["lock", "Move to Locked folder"],
                  ["history", "Version history"],
                  ["info", "File information"],
                  ["delete", "Move to trash"],
                ]
          ).map(([key, label]) => (
            <Button
              key={key}
              variant={key === "delete" || key === "permanent" ? "destructive" : "ghost"}
              className="justify-start p-3.5"
              onClick={() => {
                if (mobileFile) action(key, [mobileFile]);
                setMobileFile(null);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
