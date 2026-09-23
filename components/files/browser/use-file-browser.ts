"use client";

import type { BrowserDialog, DriveFile } from "@/types";
import { subDays } from "date-fns";
import { useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";
import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useWorkspaceRoute } from "@/components/workspace/route";
import { useWorkspace } from "@/components/workspace/store";
import { useActionGuard } from "@/hooks/use-action-guard";
import { useIsMobile } from "@/hooks/use-mobile";
import { compareByDate, isDateOnOrAfter } from "@/lib/date";
import {
  copyItems,
  moveItems,
  renameItem,
  restoreItems,
  setVisibility,
  starItems,
  trashItems,
} from "@/lib/drive/items";
import { lockItems, unlockItems } from "@/lib/drive/locked-items";
import { compareNames } from "@/lib/workspace/names";
import { downloadFile } from "../download";
import { copyFileLink } from "../remote-url";
import { parsers } from "./constants";

// State and actions shared by every part of the file browser.
export function useFileBrowser() {
  const { data, loaded, drive } = useWorkspace();
  const me = drive.listing?.workspace.userId;
  const { workspace, page: screen, team, base } = useWorkspaceRoute();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [mobileFile, setMobileFile] = useState<DriveFile | null>(null);
  // Filters replace, so adjusting them leaves Back working; `folder` and
  // `view` override this with `history: "push"` on the parser itself, which
  // also carries an update that touches both (see ./constants).
  const [query, setQuery] = useQueryStates(parsers, { history: "replace" });
  const [selected, setSelected] = useState<string[]>([]);
  const anchor = useRef<string | null>(null);
  const [dialog, setDialog] = useState<BrowserDialog | null>(null);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("root");
  const [filters, setFilters] = useState(false);
  const [confirm, setConfirm] = useState<string[] | null>(null);
  // Every mutation the browser dispatches shares one guard: the selection bar,
  // the file and context menus, the mobile sheet and the Delete key all end up
  // in `action`, so one in-flight change disables the lot of them.
  const mutation = useActionGuard();
  const byId = useMemo(() => new Map(data.files.map((f) => [f.id, f])), [data.files]);
  // Live (untrashed) children per folder, for the folder cards.
  const childCounts = useMemo(() => {
    const counts = new Map<string | null, number>();
    for (const f of data.files)
      if (!f.trashed) counts.set(f.parent, (counts.get(f.parent) ?? 0) + 1);
    return counts;
  }, [data.files]);
  const owners = useMemo(() => Array.from(new Set(data.files.map((f) => f.owner))), [data.files]);
  const currentFolder = query.folder ? byId.get(query.folder) : undefined;
  const teamInfo = team ? data.teams.find((t) => t.id === team) : undefined;
  // How far back "today"/"week"/"month" reach in the Modified filter.
  const modifiedFloor = useMemo(() => {
    switch (query.modified) {
      case "today":
        return subDays(new Date(), 1);
      case "week":
        return subDays(new Date(), 7);
      case "month":
        return subDays(new Date(), 30);
      default:
        return null;
    }
  }, [query.modified]);
  const { search, folder, type, owner, sort, direction } = query;
  const files = useMemo(() => {
    // Items aren't tagged with teams, so a team's file view is empty.
    if (team) return [];
    const needle = search.toLowerCase();
    return (
      data.files
        // Locked-folder items show up on its page and nowhere else.
        .filter((f) => (screen === "locked") === Boolean(f.locked))
        // In a shared drive, your trash holds only what you can restore.
        .filter((f) => (screen === "trash" ? f.trashed && f.canEdit : !f.trashed))
        .filter((f) =>
          screen === "starred"
            ? f.starred
            : screen === "shared"
              ? f.shared
              : screen === "recent"
                ? f.kind !== "folder"
                : screen === "trash" || search
                  ? true
                  : f.parent === (folder || null)
        )
        .filter((f) => `${f.name} ${f.owner}`.toLowerCase().includes(needle))
        .filter((f) => type === "all" || f.kind === type)
        .filter((f) => owner === "all" || f.owner === owner)
        .filter((f) => modifiedFloor === null || isDateOnOrAfter(f.modified, modifiedFloor))
        .sort((a, b) => {
          const delta =
            sort === "name"
              ? compareNames(a.name, b.name)
              : sort === "size"
                ? a.size - b.size
                : compareByDate(a.modified, b.modified);
          // Break ties by name so equal timestamps/sizes keep a stable order.
          return (direction === "asc" ? delta : -delta) || compareNames(a.name, b.name);
        })
    );
  }, [data.files, team, screen, search, folder, type, owner, sort, direction, modifiedFloor]);
  const folders = files.filter((f) => f.kind === "folder");
  const documents = files.filter((f) => f.kind !== "folder");
  const pageCount = Math.max(1, Math.ceil(documents.length / 12));
  const pageNumber = Math.max(1, Math.min(query.page, pageCount));
  const visible = documents.slice((pageNumber - 1) * 12, pageNumber * 12);
  const selectedFiles = files.filter((f) => selected.includes(f.id));
  const selectedFolderCount = selectedFiles.filter((f) => f.kind === "folder").length;
  const selectedFileCount = selectedFiles.length - selectedFolderCount;
  const selectedSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
  const clearOnBackground = (e: MouseEvent) => {
    if (e.target === e.currentTarget) setSelected([]);
  };
  const title =
    currentFolder?.name ||
    teamInfo?.name ||
    {
      drive: workspace === "personal" ? "My Drive" : "Files",
      recent: "Recent",
      starred: "Starred",
      shared: workspace === "personal" ? "Shared with me" : "Shared",
      trash: "Trash",
      locked: "Locked folder",
      teams: "Team files",
    }[screen] ||
    "Files";
  function open(file: DriveFile) {
    setSelected([]);
    if (file.kind === "folder") {
      if (!["drive", "teams", "locked"].includes(screen))
        router.push(`${base}/drive?folder=${file.id}`);
      else void setQuery({ folder: file.id, search: "", page: 1 });
    } else void setQuery({ view: file.id });
  }
  function select(file: DriveFile, e?: MouseEvent) {
    if (e?.shiftKey && anchor.current) {
      const start = files.findIndex((f) => f.id === anchor.current),
        end = files.findIndex((f) => f.id === file.id);
      setSelected(files.slice(Math.min(start, end), Math.max(start, end) + 1).map((f) => f.id));
    } else if (e?.metaKey || e?.ctrlKey || (isMobile && selected.length)) {
      setSelected((ids) =>
        ids.includes(file.id) ? ids.filter((id) => id !== file.id) : [...ids, file.id]
      );
    } else setSelected([file.id]);
    anchor.current = file.id;
  }
  // Drive-style: click selects and double-click opens. A tap (mobile, not
  // mid-selection) or keyboard activation still opens straight away.
  const openOnTap = (file: DriveFile) => (e: MouseEvent) => {
    if (e.detail !== 0 && (!isMobile || selected.length)) return;
    e.stopPropagation();
    open(file);
  };
  async function trash(ids: string[]) {
    const result = await mutation.run(() => drive.run(trashItems(ids)));
    if (!result?.ok) return;
    setSelected([]);
    toast.success(`${ids.length} item${ids.length === 1 ? "" : "s"} moved to trash`, {
      action: {
        label: "Undo",
        // Not on the shared guard: the toast closes on click, so it can't
        // fire twice, and a guard here would silently drop the undo whenever
        // something else happened to be in flight.
        onClick: () => void drive.run(restoreItems(ids)),
      },
    });
  }
  function action(kind: string, items: DriveFile[]) {
    if (!items.length) return;
    const ids = items.map((f) => f.id);
    switch (kind) {
      case "open":
      case "preview":
        open(items[0]);
        return;
      case "download":
        items.forEach((f) => void downloadFile(f));
        return;
      case "star": {
        const all = items.every((f) => f.starred);
        void mutation.run(() =>
          drive.run(starItems(ids, !all), all ? "Removed from starred" : "Added to starred")
        );
        return;
      }
      case "lock":
        if (!drive.listing?.lockedFolder.hasPin) {
          toast.info("Set up your Locked folder first.");
          router.push(`${base}/locked`);
          return;
        }
        void mutation.run(async () => {
          const result = await drive.run(lockItems(ids), "Moved to your Locked folder");
          if (result.ok) setSelected([]);
        });
        return;
      case "unlock":
        void mutation.run(async () => {
          const result = await drive.run(unlockItems(ids), "Moved to My Drive (still private)");
          if (result.ok) setSelected([]);
        });
        return;
      case "restore":
        void mutation.run(() => drive.run(restoreItems(ids), "Files restored"));
        return;
      case "visibility": {
        const next = items[0].visibility === "private" ? "shared" : "private";
        void mutation.run(() =>
          drive.run(
            setVisibility(items[0].id, next),
            next === "private" ? "Only you can see this now" : "Shared with everyone in this drive"
          )
        );
        return;
      }
      case "delete":
        void trash(ids);
        return;
      case "permanent":
        setConfirm(ids);
        return;
      case "link":
        copyFileLink(items[0].id);
        return;
    }
    setName(items[0].name);
    setTarget("root");
    setDialog({ kind, files: items });
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,[contenteditable=true],[role=dialog],[role=alertdialog]"
        ) ||
        document.querySelector('[data-slot="dialog-content"],[data-slot="alert-dialog-content"]')
      )
        return;
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        setSelected(files.map((f) => f.id));
      }
      if (e.key === "Escape") setSelected([]);
      if (e.key === "Delete" && selected.length && screen !== "trash" && screen !== "locked") {
        e.preventDefault();
        trash(selectedFiles.map((f) => f.id));
      }
      if ((e.key === "Enter" || e.key === " ") && selectedFiles.length) {
        e.preventDefault();
        open(selectedFiles[0]);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  async function commit() {
    if (!dialog || !["rename", "move", "copy"].includes(dialog.kind)) return;
    if (dialog.kind === "rename" && !name.trim()) return;
    const ids = dialog.files.map((f) => f.id);
    const parent = target === "root" ? null : target;
    // Guarded, so Enter held down in the rename field, or a double-click on
    // "Copy here", still renames once and copies once.
    const result = await mutation.run(() =>
      drive.run(
        dialog.kind === "rename"
          ? renameItem(ids[0], name.trim())
          : dialog.kind === "move"
            ? moveItems(ids, parent)
            : copyItems(ids, parent),
        { rename: "Renamed", move: "Items moved", copy: "Items copied" }[dialog.kind]
      )
    );
    if (!result?.ok) return;
    setDialog(null);
    setSelected([]);
  }
  return {
    data,
    loaded,
    drive,
    me,
    workspace,
    screen,
    isMobile,
    query,
    setQuery,
    mobileFile,
    setMobileFile,
    selected,
    setSelected,
    dialog,
    setDialog,
    name,
    setName,
    target,
    setTarget,
    filters,
    setFilters,
    confirm,
    setConfirm,
    byId,
    childCounts,
    owners,
    currentFolder,
    teamInfo,
    files,
    folders,
    documents,
    pageCount,
    pageNumber,
    visible,
    selectedFiles,
    selectedFolderCount,
    selectedFileCount,
    selectedSize,
    // True while one of the browser's mutations is in flight.
    busy: mutation.pending,
    clearOnBackground,
    title,
    open,
    select,
    openOnTap,
    action,
    commit,
  };
}

export type FileBrowserState = ReturnType<typeof useFileBrowser>;
