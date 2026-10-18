"use client";

import type { DriveFile } from "@/types";
import { subDays } from "date-fns";
import { useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";
import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useWorkspaceRoute } from "@/components/workspace/route";
import { useWorkspace } from "@/components/workspace/store";
import { useIsMobile } from "@/hooks/use-mobile";
import { compareByDate, isDateOnOrAfter } from "@/lib/date";
import { compareNames } from "@/lib/workspace/names";
import { parsers } from "./constants";
import { useFileBrowserActions } from "./use-file-browser-actions";

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
  const [filters, setFilters] = useState(false);
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
  const { trash, ...actions } = useFileBrowserActions({
    drive,
    base,
    open,
    clearSelection: () => setSelected([]),
  });
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
    filters,
    setFilters,
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
    ...actions,
    clearOnBackground,
    title,
    open,
    select,
    openOnTap,
  };
}

export type FileBrowserState = ReturnType<typeof useFileBrowser>;
