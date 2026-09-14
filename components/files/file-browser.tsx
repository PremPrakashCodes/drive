"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { BrowserDialogs } from "./browser/browser-dialogs";
import { BrowserHeader } from "./browser/browser-header";
import { BrowserToolbar } from "./browser/browser-toolbar";
import { FileSection } from "./browser/file-section";
import { FolderGrid } from "./browser/folder-grid";
import { MobileActionSheet } from "./browser/mobile-action-sheet";
import { SelectionBar } from "./browser/selection-bar";
import { useFileBrowser } from "./browser/use-file-browser";

export function FileBrowser() {
  const browser = useFileBrowser();
  if (!browser.loaded)
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  return (
    <>
      <MobileActionSheet browser={browser} />
      <BrowserHeader browser={browser} />
      <BrowserToolbar browser={browser} />
      <SelectionBar browser={browser} />
      <FolderGrid browser={browser} />
      <FileSection browser={browser} />
      <div className="mt-5 flex items-center justify-between border-t pt-4 text-[9px] text-muted-foreground md:text-[10px]">
        <span>{browser.files.length} items</span>
        <span>
          <span className="mr-[5px] rounded-[3px] border px-1 py-0.5">⌘ K</span> to find anything,
          fast
        </span>
      </div>
      <BrowserDialogs browser={browser} />
    </>
  );
}
