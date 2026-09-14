"use client";

import { Lock as LockIcon, Star, Users } from "lucide-react";

import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import { formatShortDate } from "@/lib/date";
import { formatSize } from "@/lib/workspace/data";
import { FileIcon, FileVisual } from "../file-visual";
import { cardAction, metaDot } from "./constants";
import { FileMenu, FileMenuItems } from "./file-menu";
import type { FileBrowserState } from "./use-file-browser";

// The grid view: a preview card per file on the current page.
export function FileGrid({ browser }: { browser: FileBrowserState }) {
  const { visible, clearOnBackground, selected, select, open, openOnTap } = browser;
  return (
    <div
      className="grid grid-cols-4 gap-[15px] max-[1200px]:gap-3 max-[1000px]:grid-cols-3 max-md:grid-cols-2"
      onClick={clearOnBackground}
    >
      {visible.map((f) => (
        <ContextMenu key={f.id}>
          <ContextMenuTrigger
            className="group/card flex min-w-0 flex-col overflow-hidden rounded-[12px] border bg-card transition-[border-color,box-shadow] duration-150 ease-[ease] select-none hover:border-[color-mix(in_srgb,var(--foreground)_18%,var(--border))] hover:shadow-[0_1px_2px_rgb(24_24_27/0.04),0_10px_24px_-12px_rgb(24_24_27/0.2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-selected:border-primary/28! aria-selected:bg-[color-mix(in_srgb,var(--primary)_12%,var(--card))] aria-selected:hover:shadow-none dark:hover:shadow-[0_10px_24px_-12px_rgb(0_0_0/0.65)]"
            tabIndex={0}
            aria-selected={selected.includes(f.id)}
            onClick={(e) => select(f, e)}
            onDoubleClick={() => open(f)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target === e.currentTarget) open(f);
            }}
          >
            <div className="relative h-[155px] overflow-hidden border-b group-aria-selected/card:border-b-primary/18 group-aria-selected/card:bg-[color-mix(in_srgb,var(--primary)_12%,var(--card))] max-[1200px]:h-[130px] max-[1000px]:h-[145px] max-xs:h-[120px] min-[1600px]:h-[190px]">
              <button
                className="block size-full text-left"
                aria-label={`Preview ${f.name}`}
                onClick={openOnTap(f)}
              >
                <FileVisual file={f} />
              </button>
              {f.starred && (
                <span className="absolute top-2.5 right-2.5 grid size-[26px] place-items-center rounded-full bg-card/88 shadow-[0_1px_2px_rgb(24_24_27/0.12)] backdrop-blur-[6px]">
                  <Star className="size-[13px] fill-[#f2c14e] text-[#d19a1a]" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5 py-3 pr-2 pl-3 max-[1200px]:gap-2 max-[1200px]:py-2.5 max-[1200px]:pr-1.5 max-[1200px]:pl-2.5">
              <FileIcon
                file={f}
                className="grid size-8 place-items-center rounded-[8px] bg-muted max-[1200px]:size-7 max-md:hidden [&_svg]:size-4"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <button
                  className="block min-h-0 max-w-full truncate text-left text-[13px] leading-[1.35] font-medium text-foreground max-[1200px]:text-[12.5px]"
                  title={f.name}
                  onClick={openOnTap(f)}
                >
                  {f.name}
                </button>
                <div className="flex min-w-0 items-center gap-1.5 overflow-hidden text-[11.5px] leading-[1.35] whitespace-nowrap text-muted-foreground max-[1200px]:text-[11px]">
                  <span>{formatSize(f.size)}</span>
                  <i aria-hidden="true" className={metaDot} />
                  <span>{formatShortDate(f.modified)}</span>
                  {f.shared && (
                    <>
                      <i aria-hidden="true" className={metaDot} />
                      <span className="inline-flex items-center gap-1">
                        <Users aria-hidden="true" className="size-3" />
                        <span className="max-md:hidden">Shared</span>
                      </span>
                    </>
                  )}
                  {f.visibility === "private" && (
                    <>
                      <i aria-hidden="true" className={metaDot} />
                      <span className="inline-flex items-center gap-1">
                        <LockIcon aria-hidden="true" className="size-3" />
                        <span className="max-md:hidden">Private</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="shrink-0 self-center">
                <FileMenu
                  browser={browser}
                  file={f}
                  classes={{ mobile: cardAction, desktop: cardAction }}
                />
              </div>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            <FileMenuItems browser={browser} file={f} context />
          </ContextMenuContent>
        </ContextMenu>
      ))}
    </div>
  );
}
