"use client";

import { ArrowLeft, Lock as LockIcon, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FileActions } from "@/components/workspace/shell";
import { useActionGuard } from "@/hooks/use-action-guard";
import { lockLockedFolder } from "@/lib/drive/locked-folder";
import { TRASH_RETENTION_DAYS } from "@/lib/workspace/data";
import type { FileBrowserState } from "./use-file-browser";

// The page title and its screen-specific actions.
export function BrowserHeader({
  browser: { currentFolder, setQuery, title, screen, teamInfo, files, setConfirm, drive, busy },
}: {
  browser: FileBrowserState;
}) {
  const locking = useActionGuard();
  // Button rules go through the parent so FileActions' buttons get them too.
  return (
    <div className="mb-7.25 flex items-center justify-between gap-6 **:data-[slot=button]:h-8.75 **:data-[slot=button]:gap-1.75 **:data-[slot=button]:px-3.25! **:data-[slot=button]:text-[11px] max-md:mb-5.75 max-md:items-start max-md:gap-3 max-md:[&>.flex]:gap-1.25 max-md:[&>.flex>[data-slot=button]:last-child]:hidden">
      <div>
        {currentFolder && (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3.25"
            onClick={() => void setQuery({ folder: currentFolder.parent })}
          >
            <ArrowLeft />
            Back
          </Button>
        )}
        <h1 className="text-[29px] leading-[1.3] font-[550] tracking-[-1.2px] max-md:text-[27px]">
          {title}
          <span className="text-folder-green">.</span>
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground max-md:max-w-60 max-md:text-[11px] max-md:leading-[1.6]">
          {screen === "locked"
            ? "Only you can see these. They're hidden from My Drive, search, and everyone else in this drive."
            : screen === "trash"
              ? `Deleted files are permanently removed after ${TRASH_RETENTION_DAYS} days.`
              : screen === "starred"
                ? "Your favorites, always within reach."
                : screen === "shared"
                  ? "Good work happens together. Find what’s been shared with you."
                  : screen === "recent"
                    ? "Pick up right where you left off."
                    : teamInfo
                      ? teamInfo.description
                      : "A little space for everything you’re working on."}
        </p>
      </div>
      {screen === "trash" ? (
        <Button
          variant="destructive"
          disabled={!files.length || busy}
          onClick={() => setConfirm(files.map((f) => f.id))}
        >
          <Trash2 />
          Empty trash
        </Button>
      ) : screen === "locked" ? (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="lg"
            disabled={locking.pending}
            onClick={() => void locking.run(() => drive.run(lockLockedFolder(), "Locked"))}
          >
            <LockIcon />
            {locking.pending ? "Locking…" : "Lock now"}
          </Button>
          <FileActions />
        </div>
      ) : (
        <FileActions />
      )}
    </div>
  );
}
