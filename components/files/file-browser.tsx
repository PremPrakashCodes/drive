"use client";

import type { DriveFile } from "@/lib/workspace/data";
import {
  ArrowDownWideNarrow,
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  Folder,
  FolderInput,
  FolderLock,
  FolderOutput,
  History,
  Info,
  LayoutGrid,
  Link as LinkIcon,
  List,
  Lock as LockIcon,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Star,
  Trash2,
  LockOpen as UnlockIcon,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Choice, EmptyState, PersonAvatar } from "@/components/workspace/common";
import { useWorkspaceRoute } from "@/components/workspace/route";
import { FileActions } from "@/components/workspace/shell";
import { useWorkspace } from "@/components/workspace/store";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  copyItems,
  deleteItems,
  lockItems,
  moveItems,
  renameItem,
  restoreItems,
  setVisibility,
  starItems,
  trashItems,
  unlockItems,
} from "@/lib/drive/items";
import { lockLockedFolder } from "@/lib/drive/locked-folder";
import { formatSize } from "@/lib/workspace/data";
import { canMove, collectTree, copyTree } from "@/lib/workspace/file-tree";
import { getBlob, removeBlobs, saveBlob } from "@/lib/workspace/storage";
import { downloadFile } from "./download";
import { FileIcon, FileVisual } from "./file-visual";
import { ShareDialog } from "./share-dialog";

const parsers = {
  folder: parseAsString,
  search: parseAsString.withDefault(""),
  view: parseAsStringLiteral(["grid", "list"]).withDefault("grid"),
  sort: parseAsStringLiteral(["modified", "name", "size"]).withDefault("modified"),
  direction: parseAsStringLiteral(["asc", "desc"]).withDefault("desc"),
  type: parseAsString.withDefault("all"),
  owner: parseAsString.withDefault("all"),
  modified: parseAsString.withDefault("all"),
  preview: parseAsString,
  page: parseAsInteger.withDefault(1),
};
export function FileBrowser() {
  const { data, update, loaded, drive } = useWorkspace();
  const me = drive.listing?.workspace.userId;
  const { workspace, page: screen, team, base } = useWorkspaceRoute();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [mobileFile, setMobileFile] = useState<DriveFile | null>(null);
  const [query, setQuery] = useQueryStates(parsers, { history: "push" });
  const [selected, setSelected] = useState<string[]>([]);
  const anchor = useRef<string | null>(null);
  const [dialog, setDialog] = useState<{
    kind: string;
    files: DriveFile[];
  } | null>(null);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("root");
  const [filters, setFilters] = useState(false);
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const currentFolder = data.files.find((f) => f.id === query.folder && f.workspace === workspace);
  const teamInfo = data.teams.find((t) => t.id === team && t.workspace === workspace);
  const files = useMemo(
    () =>
      data.files
        .filter((f) => f.workspace === workspace && (!team || f.team === team))
        // Locked-folder items show up on its page and nowhere else.
        .filter((f) => (screen === "locked") === Boolean(f.locked))
        // In a shared drive, your trash holds only what you can restore.
        .filter((f) => (screen === "trash" ? f.trashed && (!f.remote || f.canEdit) : !f.trashed))
        .filter((f) =>
          screen === "starred"
            ? f.starred
            : screen === "shared"
              ? f.shared
              : screen === "recent"
                ? f.kind !== "folder"
                : screen === "trash"
                  ? true
                  : query.search
                    ? true
                    : f.parent === (query.folder || null)
        )
        .filter((f) =>
          `${f.name} ${f.owner} ${f.tags?.join(" ")}`
            .toLowerCase()
            .includes(query.search.toLowerCase())
        )
        .filter((f) => query.type === "all" || f.kind === query.type)
        .filter((f) => query.owner === "all" || f.owner === query.owner)
        .filter((f) => query.modified === "all" || new Date(f.modified) >= new Date("2026-09-12"))
        .sort((a, b) => {
          const delta =
            query.sort === "name"
              ? a.name.localeCompare(b.name)
              : query.sort === "size"
                ? a.size - b.size
                : new Date(a.modified).getTime() - new Date(b.modified).getTime();
          return query.direction === "asc" ? delta : -delta;
        }),
    [data.files, workspace, team, screen, query]
  );
  const folders = files.filter((f) => f.kind === "folder");
  const documents = files.filter((f) => f.kind !== "folder");
  const pageCount = Math.max(1, Math.ceil(documents.length / 12));
  const pageNumber = Math.max(1, Math.min(query.page, pageCount));
  const visible = documents.slice((pageNumber - 1) * 12, pageNumber * 12);
  const selectedFiles = files.filter((f) => selected.includes(f.id) && f.workspace === workspace);
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
      drive: "My Drive",
      recent: "Recent",
      starred: "Starred",
      shared: "Shared with me",
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
      setSelected([]);
    } else void setQuery({ preview: file.id });
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
    if (drive.active) {
      const result = await drive.run(trashItems(ids));
      if (!result.ok) return;
      setSelected([]);
      toast.success(`${ids.length} item${ids.length === 1 ? "" : "s"} moved to trash`, {
        action: {
          label: "Undo",
          onClick: () => void drive.run(restoreItems(ids)),
        },
      });
      return;
    }
    ids = [
      ...collectTree(
        data.files.filter((f) => !f.trashed),
        ids
      ),
    ];
    update((d) => ({
      ...d,
      files: d.files.map((f) =>
        ids.includes(f.id) ? { ...f, trashed: true, deletedAt: new Date().toISOString() } : f
      ),
    }));
    setSelected([]);
    toast.success(`${ids.length} item${ids.length === 1 ? "" : "s"} moved to trash`, {
      action: {
        label: "Undo",
        onClick: () =>
          update((d) => ({
            ...d,
            files: d.files.map((f) => (ids.includes(f.id) ? { ...f, trashed: false } : f)),
          })),
      },
    });
  }
  function action(kind: string, items: DriveFile[]) {
    if (!items.length) return;
    if (drive.active) {
      const ids = items.map((f) => f.id);
      if (kind === "star") {
        const all = items.every((f) => f.starred);
        void drive.run(starItems(ids, !all), all ? "Removed from starred" : "Added to starred");
        return;
      }
      if (kind === "lock") {
        if (!drive.listing?.lockedFolder.hasPin) {
          toast.info("Set up your Locked folder first.");
          router.push(`${base}/locked`);
          return;
        }
        void drive.run(lockItems(ids), "Moved to your Locked folder").then((result) => {
          if (result.ok) setSelected([]);
        });
        return;
      }
      if (kind === "unlock") {
        void drive.run(unlockItems(ids), "Moved to My Drive (still private)").then((result) => {
          if (result.ok) setSelected([]);
        });
        return;
      }
      if (kind === "restore") {
        void drive.run(restoreItems(ids), "Files restored");
        return;
      }
      if (kind === "visibility") {
        const next = items[0].visibility === "private" ? "shared" : "private";
        void drive.run(
          setVisibility(items[0].id, next),
          next === "private" ? "Only you can see this now" : "Shared with everyone in this drive"
        );
        return;
      }
    }
    if (kind === "open" || kind === "preview") {
      open(items[0]);
      return;
    }
    if (kind === "download") {
      items.forEach((f) => void downloadFile(f));
      return;
    }
    if (kind === "star") {
      const all = items.every((f) => f.starred);
      update((d) => ({
        ...d,
        files: d.files.map((f) => (items.some((i) => i.id === f.id) ? { ...f, starred: !all } : f)),
      }));
      toast.success(all ? "Removed from starred" : "Added to starred");
      return;
    }
    if (kind === "delete") {
      trash(items.map((f) => f.id));
      return;
    }
    if (kind === "restore") {
      update((d) => ({
        ...d,
        files: d.files.map((f) =>
          collectTree(
            d.files,
            items.map((i) => i.id)
          ).has(f.id)
            ? {
                ...f,
                trashed: false,
                parent: d.files.some(
                  (p) =>
                    p.id === f.parent &&
                    p.trashed &&
                    !collectTree(
                      d.files,
                      items.map((i) => i.id)
                    ).has(p.id)
                )
                  ? null
                  : f.parent,
              }
            : f
        ),
      }));
      toast.success("Files restored");
      return;
    }
    if (kind === "permanent") {
      setConfirm(items.map((f) => f.id));
      return;
    }
    if (kind === "link") {
      navigator.clipboard
        .writeText(`${location.origin}${location.pathname}?preview=${items[0].id}`)
        .then(
          () => toast.success("Workspace link copied"),
          () => toast.error("Clipboard permission denied")
        );
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
    if (!dialog) return;
    if (drive.active && ["rename", "move", "copy"].includes(dialog.kind)) {
      if (dialog.kind === "rename" && !name.trim()) return;
      const ids = dialog.files.map((f) => f.id);
      const parent = target === "root" ? null : target;
      const result = await drive.run(
        dialog.kind === "rename"
          ? renameItem(ids[0], name.trim())
          : dialog.kind === "move"
            ? moveItems(ids, parent)
            : copyItems(ids, parent),
        { rename: "Renamed", move: "Items moved", copy: "Items copied" }[dialog.kind]
      );
      if (!result.ok) return;
      setDialog(null);
      setSelected([]);
      return;
    }
    if (dialog.kind === "rename") {
      if (!name.trim()) return;
      update((d) => ({
        ...d,
        files: d.files.map((f) => (f.id === dialog.files[0].id ? { ...f, name: name.trim() } : f)),
      }));
      toast.success("File renamed");
    }
    if (dialog.kind === "move" || dialog.kind === "copy") {
      const parent = target === "root" ? null : target;
      const ids = dialog.files.map((f) => f.id);
      if (!canMove(data.files, ids, parent)) {
        toast.error("Choose a folder outside the selected folders");
        return;
      }
      if (dialog.kind === "copy") {
        const result = copyTree(data.files, ids, parent, () => crypto.randomUUID());
        try {
          for (const [original, copy] of result.copies) {
            const blob = await getBlob(original);
            if (blob) await saveBlob(copy, blob);
          }
          update((d) => ({ ...d, files: [...d.files, ...result.files] }));
        } catch {
          toast.error("Could not copy file contents. Try freeing device storage.");
          return;
        }
      } else {
        update((d) => ({
          ...d,
          files: d.files.map((f) =>
            ids.includes(f.id) && (!f.parent || !ids.includes(f.parent)) ? { ...f, parent } : f
          ),
        }));
      }
      toast.success(dialog.kind === "move" ? "Items moved" : "Items copied");
    }
    setDialog(null);
    setSelected([]);
  }
  const menus = (file: DriveFile, context = false) => {
    const Item = context ? ContextMenuItem : DropdownMenuItem;
    const Group = context ? ContextMenuGroup : DropdownMenuGroup;
    const Separator = context ? ContextMenuSeparator : DropdownMenuSeparator;
    // Server-backed items: only their creator (or the owner, for shared ones)
    // may change them, and only the creator decides who sees them.
    const editable = !file.remote || !!file.canEdit;
    const mine = file.remote && file.ownerId === me;
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
          ? [
              [
                item("restore", "Restore", RotateCcw),
                item("permanent", "Delete permanently", Trash2),
              ],
            ]
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
                ...(!file.remote
                  ? [item("share", "Share", Users)]
                  : mine
                    ? [
                        file.visibility === "private"
                          ? item("visibility", "Share with everyone", UnlockIcon)
                          : item("visibility", "Make private", LockIcon),
                        item("lock", "Move to Locked folder", FolderLock),
                      ]
                    : []),
                item("link", "Copy link", LinkIcon),
              ],
              file.remote
                ? [item("info", "File information", Info)]
                : [
                    item("history", "Version history", History),
                    item("info", "File information", Info),
                  ],
              editable ? [item("delete", "Move to trash", Trash2)] : [],
            ]
    ).filter((g) => g.length > 0);
    return groups.map((g, i) => (
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
    ));
  };
  function menu(file: DriveFile) {
    if (isMobile)
      return (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${file.name}`}
          onClick={(e) => {
            e.stopPropagation();
            setMobileFile(file);
          }}
        >
          <MoreHorizontal />
        </Button>
      );
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" aria-label={`Actions for ${file.name}`} />}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48" align="end">
          {menus(file)}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  if (!loaded)
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
      <Sheet
        open={!!mobileFile}
        onOpenChange={(open) => {
          if (!open) setMobileFile(null);
        }}
      >
        <SheetContent side="bottom" className="mobile-file-sheet">
          <SheetHeader>
            <SheetTitle>{mobileFile?.name}</SheetTitle>
            <SheetDescription>Choose an action for this file.</SheetDescription>
          </SheetHeader>
          <div className="mobile-action-list">
            {(screen === "locked"
              ? [
                  ["preview", "Preview"],
                  ["download", "Download"],
                  ["rename", "Rename"],
                  ["move", "Move"],
                  ["unlock", "Move out of Locked folder"],
                  ["info", "File information"],
                  ["permanent", "Delete permanently"],
                ]
              : screen === "trash"
                ? [
                    ["restore", "Restore"],
                    ["permanent", "Delete permanently"],
                  ]
                : [
                    ["preview", "Preview"],
                    ["download", "Download"],
                    ["share", "Share"],
                    ["rename", "Rename"],
                    ["move", "Move"],
                    ["copy", "Copy"],
                    ["star", "Toggle star"],
                    ...(drive.active ? [["lock", "Move to Locked folder"]] : []),
                    ["history", "Version history"],
                    ["info", "File information"],
                    ["delete", "Move to trash"],
                  ]
            ).map(([key, label]) => (
              <Button
                key={key}
                variant={key === "delete" || key === "permanent" ? "destructive" : "ghost"}
                onClick={() => {
                  if (mobileFile) action(key, [mobileFile]);
                  setMobileFile(null);
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
      <div className="page-heading">
        <div>
          {currentFolder && (
            <Button
              variant="ghost"
              size="sm"
              className="page-back"
              onClick={() => void setQuery({ folder: currentFolder.parent })}
            >
              <ArrowLeft />
              Back
            </Button>
          )}
          <h1>
            {title}
            <span className="heading-dot">.</span>
          </h1>
          <p>
            {screen === "locked"
              ? "Only you can see these. They're hidden from My Drive, search, and everyone else in this drive."
              : screen === "trash"
                ? "Deleted files stay here until you permanently remove them."
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
        <div className="workspace-intro">
          <div className="intro-symbol">
            <Folder />
            <span>✦</span>
          </div>
          <div>
            <strong>Everything in its right place.</strong>
            <p>Your files, your projects, your next big idea. All together.</p>
          </div>
          <div className="intro-right">
            <span className="intro-avatars">
              {["Prem Prakash", "Priya Singh", "Rahul Sharma"].map((n) => (
                <PersonAvatar key={n} name={n} />
              ))}
            </span>
            <span>
              A space to make things happen
              <ArrowUpRight className="size-4" />
            </span>
          </div>
        </div>
      )}
      <div className="browser-toolbar">
        <div className="file-search">
          <Search className="size-4" />
          <Input
            aria-label="Search files"
            placeholder={`Search ${title.toLowerCase()}…`}
            value={query.search}
            onChange={(e) =>
              void setQuery({ search: e.target.value, page: 1 }, { history: "replace" })
            }
          />
          {query.search && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Clear search"
              onClick={() => void setQuery({ search: "" })}
            >
              <X />
            </Button>
          )}
        </div>
        <Button variant={filters ? "secondary" : "outline"} onClick={() => setFilters(!filters)}>
          <SlidersHorizontal />
          Filters
          {(query.type !== "all" || query.owner !== "all") && <span className="filter-indicator" />}
        </Button>
        <div className="toolbar-spacer" />
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" />}>
            <ArrowDownWideNarrow />
            <span className="sort-label">
              {query.sort === "modified"
                ? "Last modified"
                : query.sort === "name"
                  ? "Name"
                  : "File size"}
            </span>
            <ChevronDown />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              {["modified", "name", "size"].map((s) => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => void setQuery({ sort: s as "modified" | "name" | "size" })}
                >
                  {s === "modified" ? "Last modified" : s === "name" ? "Name" : "File size"}
                  {query.sort === s && " ✓"}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  void setQuery({
                    direction: query.direction === "asc" ? "desc" : "asc",
                  })
                }
              >
                {query.direction === "asc" ? "Ascending ↑" : "Descending ↓"}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <ToggleGroup
          value={[query.view]}
          onValueChange={(v) => {
            if (v[0]) void setQuery({ view: v[0] as "grid" | "list" });
          }}
          variant="outline"
          className="view-toggle"
        >
          <ToggleGroupItem value="grid" aria-label="Grid view">
            <LayoutGrid />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List view">
            <List />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      {filters && (
        <div className="filter-row">
          <Choice
            label="File type"
            value={query.type}
            onChange={(type) => void setQuery({ type, page: 1 })}
            options={[
              { label: "All types", value: "all" },
              ...[
                "folder",
                "image",
                "pdf",
                "video",
                "code",
                "document",
                "spreadsheet",
                "audio",
                "archive",
              ].map((value) => ({
                value,
                label: value[0].toUpperCase() + value.slice(1),
              })),
            ]}
          />
          <Choice
            label="Owner"
            value={query.owner}
            onChange={(owner) => void setQuery({ owner, page: 1 })}
            options={[
              { label: "All owners", value: "all" },
              ...Array.from(
                new Set(data.files.filter((f) => f.workspace === workspace).map((f) => f.owner))
              ),
            ]}
          />
          <Choice
            label="Modified"
            value={query.modified}
            onChange={(modified) => void setQuery({ modified, page: 1 })}
            options={[
              { label: "Any time", value: "all" },
              { label: "Since Sep 12", value: "recent" },
            ]}
          />
          <Button
            variant="ghost"
            onClick={() => void setQuery({ type: "all", owner: "all", modified: "all" })}
          >
            Clear filters
          </Button>
        </div>
      )}
      {selectedFiles.length > 0 && (
        <div className="selection-bar" role="toolbar" aria-label="Selection actions">
          <div className="selection-summary">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Clear selection"
              title="Clear selection (Esc)"
              onClick={() => setSelected([])}
            >
              <X />
            </Button>
            <div aria-live="polite">
              <strong>{selectedFiles.length} selected</strong>
              <small>
                {[
                  selectedFileCount &&
                    `${selectedFileCount} file${selectedFileCount === 1 ? "" : "s"}`,
                  selectedFolderCount &&
                    `${selectedFolderCount} folder${selectedFolderCount === 1 ? "" : "s"}`,
                  selectedSize && formatSize(selectedSize),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </div>
            {selectedFiles.length < files.length && (
              <button className="selection-all" onClick={() => setSelected(files.map((f) => f.id))}>
                Select all
              </button>
            )}
          </div>
          <span className="selection-divider" aria-hidden="true" />
          <div className="selection-actions">
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
                    ...(drive.active ? [["lock", "Lock", FolderLock]] : []),
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
                  className={a === "delete" || a === "permanent" ? "selection-danger" : undefined}
                  onClick={() => action(a as string, selectedFiles)}
                >
                  <I />
                  <span>{label as string}</span>
                </Button>
              );
            })}
          </div>
        </div>
      )}
      {folders.length > 0 && screen !== "trash" && (
        <section className="folder-section" onClick={clearOnBackground}>
          <div className="section-heading">
            <h2>
              Folders <span>{folders.length.toString().padStart(2, "0")}</span>
            </h2>
            <button onClick={() => window.dispatchEvent(new Event("drive:new-folder"))}>
              New folder <PlusIcon />
            </button>
          </div>
          <div
            className={`folder-grid ${selected.length ? "is-selecting" : ""}`}
            onClick={clearOnBackground}
          >
            {folders.map((f) => (
              <ContextMenu key={f.id}>
                <ContextMenuTrigger
                  className={`folder-card ${selected.includes(f.id) ? "is-selected" : ""}`}
                  tabIndex={0}
                  aria-selected={selected.includes(f.id)}
                  onClick={(e) => select(f, e)}
                  onDoubleClick={() => open(f)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.target === e.currentTarget) open(f);
                  }}
                >
                  <div className="folder-top">
                    <button
                      className="folder-open"
                      aria-label={`Open ${f.name}`}
                      onClick={openOnTap(f)}
                    >
                      <FileIcon file={f} />
                    </button>
                    {menu(f)}
                  </div>
                  <button className="folder-name" onClick={openOnTap(f)}>
                    {f.name}
                    {f.shared && <Users className="size-3.5" />}
                    {f.visibility === "private" && (
                      <LockIcon className="size-3.5" role="img" aria-label="Private" />
                    )}
                  </button>
                  <div className="folder-meta">
                    <span>
                      {data.files.filter((x) => x.parent === f.id && !x.trashed).length} files
                    </span>
                    <span>
                      {f.remote
                        ? f.visibility === "private"
                          ? "Only you"
                          : f.ownerId === me
                            ? "Shared by you"
                            : `Added by ${f.owner.split(" ")[0]}`
                        : f.shared
                          ? "Shared folder"
                          : "Only you"}
                    </span>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>{menus(f, true)}</ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        </section>
      )}
      <section className="files-section" onClick={clearOnBackground}>
        <div className="section-heading">
          <h2>
            {screen === "trash"
              ? "Deleted files"
              : query.search
                ? "Search results"
                : screen === "recent"
                  ? "Recently opened"
                  : query.folder
                    ? "Files"
                    : "All files"}{" "}
            <span>
              {(screen === "trash" ? files.length : documents.length).toString().padStart(2, "0")}
            </span>
          </h2>
          <span className="section-caption">
            {screen === "trash" ? "Restore or remove permanently" : "A home for your work"}
          </span>
        </div>
        {files.length === 0 ? (
          <EmptyState
            title={
              query.search
                ? "No matching files"
                : screen === "locked"
                  ? "Nothing hidden yet"
                  : screen === "starred"
                    ? "Nothing starred"
                    : screen === "trash"
                      ? "Your trash is empty"
                      : query.folder
                        ? "This folder is a fresh start"
                        : "No files here yet"
            }
            description={
              query.search
                ? "Try a different search or clear your filters."
                : screen === "locked"
                  ? "Upload files, create a folder, or choose “Move to Locked folder” on any file you added."
                  : screen === "starred"
                    ? "Star a file or folder to find it here."
                    : "Upload a file or create a folder to get started."
            }
          >
            <Button
              onClick={() =>
                query.search
                  ? void setQuery({
                      search: "",
                      type: "all",
                      owner: "all",
                      modified: "all",
                    })
                  : window.dispatchEvent(new Event("drive:new-folder"))
              }
            >
              {query.search ? "Clear search" : "New folder"}
            </Button>
          </EmptyState>
        ) : query.view === "list" || screen === "trash" ? (
          <Table className="file-table">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Select all files"
                    checked={files.length > 0 && files.every((f) => selected.includes(f.id))}
                    onCheckedChange={(checked) =>
                      setSelected(checked ? files.map((f) => f.id) : [])
                    }
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>{screen === "trash" ? "Original location" : "Type"}</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>{screen === "trash" ? "Deleted" : "Modified"}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(screen === "trash" ? files : visible).map((f) => (
                <TableRow
                  key={f.id}
                  data-state={selected.includes(f.id) ? "selected" : undefined}
                  onClick={(e) => select(f, e)}
                  onDoubleClick={() => screen !== "trash" && open(f)}
                  tabIndex={0}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      aria-label={`Select ${f.name}`}
                      checked={selected.includes(f.id)}
                      onCheckedChange={(checked) =>
                        setSelected((ids) =>
                          checked ? [...ids, f.id] : ids.filter((id) => id !== f.id)
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <button
                      className="table-file-name"
                      onClick={() => screen !== "trash" && open(f)}
                    >
                      <FileIcon file={f} />
                      {f.name}
                      {f.starred && <Star className="starred-icon size-3.5" />}
                      {f.visibility === "private" && (
                        <LockIcon
                          className="size-3.5 text-muted-foreground"
                          role="img"
                          aria-label="Private"
                        />
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="capitalize">
                    {screen === "trash"
                      ? data.files.find((x) => x.id === f.parent)?.name || "My Drive"
                      : f.kind}
                  </TableCell>
                  <TableCell>{f.kind === "folder" ? "—" : formatSize(f.size)}</TableCell>
                  <TableCell>
                    <span className="table-owner">
                      <PersonAvatar name={f.owner} />
                      {f.owner.split(" ")[0]}
                    </span>
                  </TableCell>
                  <TableCell>
                    {new Date(
                      (screen === "trash" ? f.deletedAt : undefined) || f.modified
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </TableCell>
                  <TableCell>{menu(f)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div
            className={`file-grid ${selected.length ? "is-selecting" : ""}`}
            onClick={clearOnBackground}
          >
            {visible.map((f) => (
              <ContextMenu key={f.id}>
                <ContextMenuTrigger
                  className={`file-card ${selected.includes(f.id) ? "is-selected" : ""}`}
                  tabIndex={0}
                  aria-selected={selected.includes(f.id)}
                  onClick={(e) => select(f, e)}
                  onDoubleClick={() => open(f)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.target === e.currentTarget) open(f);
                  }}
                >
                  <div className="file-preview-area">
                    <button
                      className="preview-image-button"
                      aria-label={`Preview ${f.name}`}
                      onClick={openOnTap(f)}
                    >
                      <FileVisual file={f} />
                    </button>
                    {f.starred && (
                      <span className="card-star">
                        <Star />
                      </span>
                    )}
                  </div>
                  <div className="file-card-info">
                    <FileIcon file={f} />
                    <div className="file-card-text">
                      <button className="file-card-name" title={f.name} onClick={openOnTap(f)}>
                        {f.name}
                      </button>
                      <div className="file-card-meta">
                        <span>{formatSize(f.size)}</span>
                        <i aria-hidden="true" />
                        <span>
                          {new Date(f.modified).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        {f.shared && (
                          <>
                            <i aria-hidden="true" />
                            <span className="file-card-shared">
                              <Users aria-hidden="true" />
                              <span>Shared</span>
                            </span>
                          </>
                        )}
                        {f.visibility === "private" && (
                          <>
                            <i aria-hidden="true" />
                            <span className="file-card-shared">
                              <LockIcon aria-hidden="true" />
                              <span>Private</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="file-card-actions">{menu(f)}</div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-48">{menus(f, true)}</ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        )}
        {pageCount > 1 && (
          <div className="pagination">
            <Button
              variant="outline"
              disabled={pageNumber === 1}
              onClick={() => void setQuery({ page: pageNumber - 1 })}
            >
              <ChevronLeft />
              Previous
            </Button>
            <span>
              Page {pageNumber} of {pageCount}
            </span>
            <Button
              variant="outline"
              disabled={pageNumber === pageCount}
              onClick={() => void setQuery({ page: pageNumber + 1 })}
            >
              Next
              <ChevronRight />
            </Button>
          </div>
        )}
      </section>
      <div className="browser-bottom">
        <span>{files.length} items</span>
        <span>
          <span className="shortcut-key">⌘ K</span> to find anything, fast
        </span>
      </div>
      <ShareDialog
        files={dialog?.kind === "share" ? dialog.files : []}
        onClose={() => setDialog(null)}
      />
      <Dialog
        open={!!dialog && dialog.kind !== "share"}
        onOpenChange={(o) => {
          if (!o) setDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {
                {
                  rename: "Rename file",
                  move: "Move to folder",
                  copy: "Copy to folder",
                  history: "Version history",
                  info: "File information",
                }[dialog?.kind || ""]
              }
            </DialogTitle>
            <DialogDescription>{dialog?.files.map((f) => f.name).join(", ")}</DialogDescription>
          </DialogHeader>
          {dialog?.kind === "info" ? (
            <dl className="info-list">
              {Object.entries({
                Type: dialog.files[0].kind,
                Size: formatSize(dialog.files[0].size),
                Owner: dialog.files[0].owner,
                Modified: new Date(dialog.files[0].modified).toLocaleString(),
                Location: `${workspace === "personal" ? "My Drive" : workspace} / ${data.files.find((f) => f.id === dialog.files[0].parent)?.name || ""}`,
                Access: dialog.files[0].remote
                  ? dialog.files[0].visibility === "private"
                    ? "Only you"
                    : "Everyone in this drive"
                  : dialog.files[0].shared
                    ? "Shared with your team"
                    : "Only you",
                Storage: dialog.files[0].provider,
              }).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          ) : dialog?.kind === "history" ? (
            <div className="version-entry">
              <History />
              <div>
                <strong>Current version</strong>
                <p>
                  {dialog.files[0].owner} ·{" "}
                  {new Date(dialog.files[0].modified).toLocaleDateString()}
                </p>
                <small>Version tracking requires a connected backend.</small>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                commit();
              }}
            >
              <FieldGroup>
                <Field>
                  <FieldLabel>
                    {dialog?.kind === "rename" ? "File name" : "Destination folder"}
                  </FieldLabel>
                  {dialog?.kind === "rename" ? (
                    <Input
                      aria-label="File name"
                      autoFocus
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  ) : (
                    <Choice
                      label="Destination folder"
                      value={target}
                      onChange={setTarget}
                      options={[
                        {
                          label: screen === "locked" ? "Locked folder" : "My Drive",
                          value: "root",
                        },
                        ...data.files
                          .filter(
                            (f) =>
                              f.workspace === workspace &&
                              f.kind === "folder" &&
                              !f.trashed &&
                              // Moves stay inside or outside the Locked folder.
                              (screen === "locked") === Boolean(f.locked) &&
                              !dialog?.files.some((i) => i.id === f.id)
                          )
                          .map((f) => ({ label: f.name, value: f.id })),
                      ]}
                    />
                  )}
                </Field>
              </FieldGroup>
              <DialogFooter className="mt-6">
                <Button variant="outline" type="button" onClick={() => setDialog(null)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {dialog?.kind === "rename"
                    ? "Save name"
                    : dialog?.kind === "move"
                      ? "Move here"
                      : "Copy here"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!confirm}
        onOpenChange={(o) => {
          if (!o) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete {confirm?.length} items?</AlertDialogTitle>
            <AlertDialogDescription>
              {drive.active
                ? "The files are removed from storage for everyone. This can't be undone."
                : "This removes the selected items from this demo. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (drive.active) {
                  const result = await drive.run(
                    deleteItems(confirm || []),
                    "Items permanently deleted"
                  );
                  if (!result.ok) return;
                  setConfirm(null);
                  setSelected([]);
                  return;
                }
                const ids = collectTree(data.files, confirm || []);
                try {
                  await removeBlobs([...ids]);
                } catch {
                  toast.error("Could not remove file content. Please retry.");
                  return;
                }
                update((d) => ({
                  ...d,
                  files: d.files.filter((f) => !ids.has(f.id)),
                }));
                setConfirm(null);
                setSelected([]);
                toast.success("Items permanently deleted");
              }}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
