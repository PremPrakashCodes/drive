"use client";

import { SectionSkeleton } from "@/components/workspace/section-skeleton";
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
  if (!browser.loaded) return <SectionSkeleton />;
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
          <span className="mr-1.25 rounded-[3px] border px-1 py-0.5">⌘ K</span> to find anything,
          fast
        </span>
      </div>
      <BrowserDialogs browser={browser} />
    </>
  );
}
