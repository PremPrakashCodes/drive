"use client";

import { ArrowLeft, ArrowUpRight, Folder, Lock as LockIcon, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/components/workspace/common";
import { FileActions } from "@/components/workspace/shell";
import { lockLockedFolder } from "@/lib/drive/locked-folder";
import { cn } from "@/lib/utils";
import { TRASH_RETENTION_DAYS } from "@/lib/workspace/data";
import type { FileBrowserState } from "./use-file-browser";

// The page title, its screen-specific actions, and My Drive's intro banner.
export function BrowserHeader({
  browser: { currentFolder, setQuery, title, screen, teamInfo, files, setConfirm, drive, query },
}: {
  browser: FileBrowserState;
}) {
  return (
    <>
      {/* Button rules go through the parent so FileActions' buttons get them too. */}
      <div className="mb-[29px] flex items-center justify-between gap-6 max-md:mb-[23px] max-md:items-start max-md:gap-3 [&_[data-slot=button]]:h-[35px] [&_[data-slot=button]]:gap-[7px] [&_[data-slot=button]]:px-[13px]! [&_[data-slot=button]]:text-[11px] max-md:[&>.flex]:gap-[5px] max-md:[&>.flex>[data-slot=button]:last-child]:hidden">
        <div>
          {currentFolder && (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-[13px]"
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
          <p className="mt-2 text-[13px] text-muted-foreground max-md:max-w-[240px] max-md:text-[11px] max-md:leading-[1.6]">
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
            disabled={!files.length}
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
              onClick={() => void drive.run(lockLockedFolder(), "Locked")}
            >
              <LockIcon />
              Lock now
            </Button>
            <FileActions />
          </div>
        ) : (
          <FileActions />
        )}
      </div>
      {!query.folder && !query.search && screen === "drive" && (
        <div className="mb-[29px] flex items-center gap-[18px] rounded-[10px] border bg-sidebar px-[22px] py-5 max-md:gap-[13px] max-md:p-[17px]">
          <div className="relative grid size-12 place-items-center rounded-full border bg-background text-primary max-md:size-[39px] max-md:shrink-0">
            <Folder className="size-[25px] stroke-[1.3]" />
            <span className="absolute right-[7px] bottom-1 bg-background text-[15px] leading-[12px]">
              ✦
            </span>
          </div>
          <div>
            <strong className="text-[14px] font-[550] max-md:text-[12px]">
              Everything in its right place.
            </strong>
            <p className="mt-[5px] text-[12px] text-muted-foreground max-md:text-[10px] max-md:leading-[1.7]">
              Your files, your projects, your next big idea. All together.
            </p>
          </div>
          <div className="ml-auto flex flex-col items-end gap-2 max-[1200px]:hidden">
            <span className="inline-flex pl-[7px]">
              {["Prem Prakash", "Priya Singh", "Rahul Sharma"].map((n, i) => (
                <PersonAvatar
                  key={n}
                  name={n}
                  className={cn(
                    "-ml-[7px] size-[25px]! border-2 border-sidebar",
                    i === 1 &&
                      "[&_[data-slot=avatar-fallback]]:bg-surface-purple! [&_[data-slot=avatar-fallback]]:text-folder-purple!",
                    i === 2 &&
                      "[&_[data-slot=avatar-fallback]]:bg-surface-blue! [&_[data-slot=avatar-fallback]]:text-folder-blue!"
                  )}
                />
              ))}
            </span>
            <span className="flex items-center gap-2 text-[9px] text-muted-foreground">
              A space to make things happen
              <ArrowUpRight className="size-4" />
            </span>
          </div>
        </div>
      )}
    </>
  );
}
