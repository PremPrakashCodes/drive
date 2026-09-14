"use client";

import { Lock as LockIcon, Plus, Users } from "lucide-react";

import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import { FileIcon } from "../file-visual";
import { FileMenu, FileMenuItems } from "./file-menu";
import type { FileBrowserState } from "./use-file-browser";

// The Folders section above the files (hidden in the trash).
export function FolderGrid({ browser }: { browser: FileBrowserState }) {
  const { folders, screen, clearOnBackground, selected, select, open, openOnTap, childCounts, me } =
    browser;
  if (!folders.length || screen === "trash") return null;
  return (
    <section className="mb-[29px]" onClick={clearOnBackground}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-[9px] text-[13px] font-[550] md:text-[14px]">
          Folders{" "}
          <span className="text-[10px] font-normal text-muted-foreground">
            {folders.length.toString().padStart(2, "0")}
          </span>
        </h2>
        <button
          className="flex items-center gap-[7px] text-[10px] text-muted-foreground md:text-[11px]"
          onClick={() => window.dispatchEvent(new Event("drive:new-folder"))}
        >
          New folder <Plus className="size-3.5" />
        </button>
      </div>
      <div
        className="grid grid-cols-4 gap-[15px] max-[1200px]:gap-3 max-[1000px]:grid-cols-2"
        onClick={clearOnBackground}
      >
        {folders.map((f) => (
          <ContextMenu key={f.id}>
            <ContextMenuTrigger
              className="relative min-w-0 rounded-[9px] border bg-card px-[15px] pt-3.5 pb-[13px] transition-[border-color,translate] duration-150 ease-[ease] select-none hover:-translate-y-px hover:border-folder-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-selected:translate-none aria-selected:border-primary/28! aria-selected:bg-[color-mix(in_srgb,var(--primary)_12%,var(--card))] max-md:p-[13px] min-[1600px]:p-[18px]"
              tabIndex={0}
              aria-selected={selected.includes(f.id)}
              onClick={(e) => select(f, e)}
              onDoubleClick={() => open(f)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.target === e.currentTarget) open(f);
              }}
            >
              <div className="mb-[15px] flex items-center justify-between max-[1000px]:mb-[9px] max-md:gap-1.5">
                <button
                  className="mr-auto text-left max-md:min-h-9"
                  aria-label={`Open ${f.name}`}
                  onClick={openOnTap(f)}
                >
                  <FileIcon file={f} />
                </button>
                <FileMenu
                  browser={browser}
                  file={f}
                  classes={{
                    mobile:
                      "h-[23px]! w-5! text-muted-foreground hover:text-muted-foreground aria-expanded:text-muted-foreground max-md:min-h-9",
                  }}
                />
              </div>
              <button
                className="flex w-full items-center justify-between gap-2 text-left text-[12px] font-medium max-md:min-h-9 md:text-[14px]"
                onClick={openOnTap(f)}
              >
                {f.name}
                {f.shared && <Users className="size-3.5 text-muted-foreground" />}
                {f.visibility === "private" && (
                  <LockIcon
                    className="size-3.5 text-muted-foreground"
                    role="img"
                    aria-label="Private"
                  />
                )}
              </button>
              <div className="mt-[7px] flex justify-between text-[9px] text-muted-foreground md:text-[11px]">
                <span>{childCounts.get(f.id) ?? 0} files</span>
                <span>
                  {f.visibility === "private"
                    ? "Only you"
                    : f.ownerId === me
                      ? "Shared by you"
                      : `Added by ${f.owner.split(" ")[0]}`}
                </span>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <FileMenuItems browser={browser} file={f} context />
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>
    </section>
  );
}
