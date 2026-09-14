"use client";

import type { DriveFile, MenuClasses } from "@/types";
import {
  Copy,
  Download,
  Eye,
  FolderInput,
  FolderLock,
  FolderOutput,
  Info,
  Link as LinkIcon,
  Lock as LockIcon,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Star,
  Trash2,
  LockOpen as UnlockIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FileBrowserState } from "./use-file-browser";

// A file's action groups, for its dropdown (default) or context menu.
export function FileMenuItems({
  browser: { screen, me, action },
  file,
  context = false,
}: {
  browser: FileBrowserState;
  file: DriveFile;
  context?: boolean;
}) {
  const Item = context ? ContextMenuItem : DropdownMenuItem;
  const Group = context ? ContextMenuGroup : DropdownMenuGroup;
  const Separator = context ? ContextMenuSeparator : DropdownMenuSeparator;
  // Server-backed items: only their creator (or the owner, for shared ones)
  // may change them, and only the creator decides who sees them.
  const editable = !!file.canEdit;
  const mine = file.ownerId === me;
  const item = (key: string, label: string, Icon: typeof Eye) => [key, label, Icon] as const;
  // Locked-folder items: no sharing, starring, copying, or trash.
  const lockedGroups = [
    [item("open", "Open", Eye), item("preview", "Preview", Eye)],
    [
      item("download", "Download", Download),
      item("rename", "Rename", Pencil),
      item("move", "Move to…", FolderInput),
      item("unlock", "Move out of Locked folder", FolderOutput),
    ],
    [item("info", "File information", Info)],
    [item("permanent", "Delete permanently", Trash2)],
  ];
  const groups = (
    screen === "locked"
      ? lockedGroups
      : screen === "trash"
        ? [[item("restore", "Restore", RotateCcw), item("permanent", "Delete permanently", Trash2)]]
        : [
            [item("open", "Open", Eye), item("preview", "Preview", Eye)],
            [
              item("download", "Download", Download),
              ...(editable
                ? [item("rename", "Rename", Pencil), item("move", "Move to…", FolderInput)]
                : []),
              item("copy", "Make a copy", Copy),
            ],
            [
              item("star", file.starred ? "Remove star" : "Add to starred", Star),
              ...(mine
                ? [
                    file.visibility === "private"
                      ? item("visibility", "Share with everyone", UnlockIcon)
                      : item("visibility", "Make private", LockIcon),
                    item("lock", "Move to Locked folder", FolderLock),
                  ]
                : []),
              item("link", "Copy link", LinkIcon),
            ],
            [item("info", "File information", Info)],
            editable ? [item("delete", "Move to trash", Trash2)] : [],
          ]
  ).filter((g) => g.length > 0);
  return (
    <>
      {groups.map((g, i) => (
        <Group key={i}>
          {i > 0 && <Separator />}
          {g.map(([key, label, Icon]) => {
            const I = Icon as typeof Eye;
            return (
              <Item
                key={key as string}
                onClick={() => action(key as string, [file])}
                variant={key === "delete" || key === "permanent" ? "destructive" : "default"}
              >
                <I />
                {label as string}
              </Item>
            );
          })}
        </Group>
      ))}
    </>
  );
}

// A file's "…" button: a dropdown on desktop, the action sheet on mobile.
export function FileMenu({
  browser,
  file,
  classes = {},
}: {
  browser: FileBrowserState;
  file: DriveFile;
  classes?: MenuClasses;
}) {
  if (browser.isMobile)
    return (
      <Button
        variant="ghost"
        size="icon"
        className={classes.mobile}
        aria-label={`Actions for ${file.name}`}
        onClick={(e) => {
          e.stopPropagation();
          browser.setMobileFile(file);
        }}
      >
        <MoreHorizontal />
      </Button>
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className={classes.desktop}
            aria-label={`Actions for ${file.name}`}
          />
        }
        onClick={(e) => e.stopPropagation()}
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48" align="end">
        <FileMenuItems browser={browser} file={file} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
