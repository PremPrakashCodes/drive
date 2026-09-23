"use client";

import {
  Copy,
  Download,
  Eye,
  FolderInput,
  FolderLock,
  FolderOutput,
  RotateCcw,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatSize } from "@/lib/workspace/data";
import type { FileBrowserState } from "./use-file-browser";

// The floating toolbar shown while files are selected.
export function SelectionBar({
  browser: {
    selectedFiles,
    selectedFileCount,
    selectedFolderCount,
    selectedSize,
    files,
    setSelected,
    screen,
    action,
    busy,
  },
}: {
  browser: FileBrowserState;
}) {
  if (!selectedFiles.length) return null;
  return (
    <div
      data-selection-bar
      className="fixed bottom-6 left-1/2 z-40 flex max-w-[calc(100vw-32px)] -translate-x-1/2 animate-selection-bar-in items-center gap-1.5 rounded-[14px] border bg-popover/92 p-1.5 shadow-[0_1px_2px_rgb(24_24_27/0.06),0_16px_40px_-12px_rgb(24_24_27/0.28)] backdrop-blur-md max-md:right-3 max-md:bottom-3 max-md:left-3 max-md:max-w-none max-md:translate-none max-md:animate-selection-bar-in-mobile max-md:flex-wrap max-md:gap-0.5 dark:shadow-[0_16px_40px_-12px_rgb(0_0_0/0.7)]"
      role="toolbar"
      aria-label="Selection actions"
    >
      <div className="flex items-center gap-2 pr-1 max-md:w-full max-md:pr-0">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Clear selection"
          title="Clear selection (Esc)"
          onClick={() => setSelected([])}
        >
          <X />
        </Button>
        <div aria-live="polite" className="flex flex-col leading-tight whitespace-nowrap">
          <strong className="text-[13px] font-semibold">{selectedFiles.length} selected</strong>
          <small className="text-[11px] text-muted-foreground">
            {[
              selectedFileCount && `${selectedFileCount} file${selectedFileCount === 1 ? "" : "s"}`,
              selectedFolderCount &&
                `${selectedFolderCount} folder${selectedFolderCount === 1 ? "" : "s"}`,
              selectedSize && formatSize(selectedSize),
            ]
              .filter(Boolean)
              .join(" · ")}
          </small>
        </div>
        {selectedFiles.length < files.length && (
          <button
            className="rounded-[8px] px-2.25 py-1.25 text-[12px] font-medium whitespace-nowrap text-foreground hover:bg-accent max-md:ml-auto"
            onClick={() => setSelected(files.map((f) => f.id))}
          >
            Select all
          </button>
        )}
      </div>
      <span
        className="mx-0.5 my-1.5 w-px self-stretch bg-border max-md:hidden"
        aria-hidden="true"
      />
      <div className="flex items-center gap-0.5 overflow-x-auto max-md:w-full max-md:justify-between max-md:border-t max-md:pt-1">
        {(screen === "locked"
          ? [
              ["download", "Download", Download],
              ["move", "Move", FolderInput],
              ["unlock", "Move out", FolderOutput],
              ["permanent", "Delete", Trash2],
            ]
          : screen === "trash"
            ? [
                ["restore", "Restore", RotateCcw],
                ["permanent", "Delete", Trash2],
              ]
            : [
                ["download", "Download", Download],
                ["share", "Share", Users],
                ["move", "Move", FolderInput],
                ["copy", "Copy", Copy],
                ["star", selectedFiles.every((f) => f.starred) ? "Unstar" : "Star", Star],
                ["lock", "Lock", FolderLock],
                ["delete", "Trash", Trash2],
              ]
        ).map(([a, label, Icon]) => {
          const I = Icon as typeof Eye;
          return (
            <Button
              variant="ghost"
              key={a as string}
              title={label as string}
              aria-label={label as string}
              className={cn(
                "h-9 gap-1.5 rounded-[9px] px-2.5 text-[12.5px] max-[1100px]:w-9.5 max-[1100px]:justify-center max-[1100px]:p-0 max-md:min-h-11 max-md:w-11 [&_svg]:text-muted-foreground hover:[&_svg]:text-foreground",
                (a === "delete" || a === "permanent") &&
                  "text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/10 [&_svg]:text-destructive hover:[&_svg]:text-destructive"
              )}
              disabled={busy}
              onClick={() => action(a as string, selectedFiles)}
            >
              <I />
              <span className="max-[1100px]:hidden">{label as string}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
