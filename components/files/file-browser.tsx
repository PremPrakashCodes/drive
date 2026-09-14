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
  compareByDate,
  formatFullTimestamp,
  formatMediumDate,
  formatShortDate,
  isDateOnOrAfter,
} from "@/lib/date";
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
import { cn } from "@/lib/utils";
import { formatSize } from "@/lib/workspace/data";
import { canMove, collectTree, copyTree } from "@/lib/workspace/file-tree";
import { getBlob, removeBlobs, saveBlob } from "@/lib/workspace/storage";
import { subDays } from "date-fns";
import { downloadFile } from "./download";
import { FileIcon, FileVisual } from "./file-visual";
import { ShareDialog } from "./share-dialog";

const metaDot = "size-[3px] shrink-0 rounded-full bg-current opacity-50";
const toolbarButton = "text-[11px] md:text-[12px] max-md:min-h-9";
const viewToggleItem =
  "h-[27px] w-[30px] rounded-[4px]! border-0 text-muted-foreground shadow-none focus-visible:ring-0 data-pressed:bg-background data-pressed:text-foreground data-pressed:shadow-[0_1px_3px_#0000000d] max-md:min-h-9";
const cardAction =
  "size-[30px] rounded-[8px] text-muted-foreground group-hover/card:text-foreground data-popup-open:text-foreground max-md:min-h-9 max-md:min-w-9";

const parsers = {
  folder: parseAsString,
  search: parseAsString.withDefault(""),
  view: parseAsStringLiteral(["grid", "list"]).withDefault("grid"),
  sort: parseAsStringLiteral(["modified", "name", "size"]).withDefault("modified"),
  direction: parseAsStringLiteral(["asc", "desc"]).withDefault("desc"),
  type: parseAsString.withDefault("all"),
  owner: parseAsString.withDefault("all"),
  modified: parseAsStringLiteral(["all", "today", "week", "month"]).withDefault("all"),
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
  const currentFolder = data.files.find((f) => f.id === query.folder);
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
  const files = useMemo(
    () =>
      data.files
        .filter((f) => !team || f.team === team)
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
        .filter((f) => modifiedFloor === null || isDateOnOrAfter(f.modified, modifiedFloor))
        .sort((a, b) => {
          const delta =
            query.sort === "name"
              ? a.name.localeCompare(b.name)
              : query.sort === "size"
                ? a.size - b.size
                : compareByDate(a.modified, b.modified);
          return query.direction === "asc" ? delta : -delta;
        }),
    [data.files, team, screen, query, modifiedFloor]
  );
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
  // `mobile` styles the plain Button; `desktop` the dropdown trigger, which
  // renders with data-slot="dropdown-menu-trigger" instead of "button".
  function menu(file: DriveFile, classes: { mobile?: string; desktop?: string } = {}) {
    if (isMobile)
      return (
        <Button
          variant="ghost"
          size="icon"
          className={classes.mobile}
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
        <SheetContent side="bottom" className="max-h-[85svh]">
          <SheetHeader>
            <SheetTitle>{mobileFile?.name}</SheetTitle>
            <SheetDescription>Choose an action for this file.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col overflow-y-auto px-5 pb-[25px]">
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
                className="justify-start p-3.5"
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
      <div className="mb-[25px] flex items-center gap-2.5 border-b pb-[23px] max-[1000px]:gap-[7px] max-md:mb-[22px] max-md:flex-wrap max-md:gap-y-3 max-md:pb-[18px]">
        <div className="flex w-[255px] items-center gap-2 rounded-[7px] border bg-background pl-[11px] text-muted-foreground focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring max-[1000px]:w-[210px] max-md:w-[calc(100%-85px)]">
          <Search className="size-4" />
          <Input
            className="h-[33px] rounded-[7px] border-0 bg-transparent py-2 pr-2 pl-0 text-[11px] shadow-none focus-visible:shadow-none focus-visible:ring-0 focus-visible:outline-none md:text-[12px] dark:bg-transparent"
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
              className={toolbarButton}
              aria-label="Clear search"
              onClick={() => void setQuery({ search: "" })}
            >
              <X />
            </Button>
          )}
        </div>
        <Button
          variant={filters ? "secondary" : "outline"}
          className={toolbarButton}
          onClick={() => setFilters(!filters)}
        >
          <SlidersHorizontal />
          Filters
          {(query.type !== "all" || query.owner !== "all") && (
            <span className="size-[5px] rounded-full bg-primary" />
          )}
        </Button>
        <div className="flex-1" />
        <DropdownMenu>
          {/* data-slot="dropdown-menu-trigger" here, so the toolbar font size never applied. */}
          <DropdownMenuTrigger
            render={<Button variant="ghost" className="max-md:ml-auto max-md:min-h-9" />}
          >
            <ArrowDownWideNarrow />
            <span className="max-[1000px]:hidden">
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
          className="gap-0.5 rounded-[6px] bg-muted p-[3px]"
        >
          <ToggleGroupItem value="grid" aria-label="Grid view" className={viewToggleItem}>
            <LayoutGrid />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List view" className={viewToggleItem}>
            <List />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      {filters && (
        <div className="flex flex-wrap gap-[9px] pb-5">
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
              ...Array.from(new Set(data.files.map((f) => f.owner))).map((owner) => ({
                label: owner,
                value: owner,
              })),
            ]}
          />
          <Choice
            label="Modified"
            value={query.modified}
            onChange={(modified) =>
              void setQuery({ modified: modified as "all" | "today" | "week" | "month", page: 1 })
            }
            options={[
              { label: "Any time", value: "all" },
              { label: "Today", value: "today" },
              { label: "This week", value: "week" },
              { label: "This month", value: "month" },
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
        <div
          data-selection-bar
          className="fixed bottom-6 left-1/2 z-40 flex max-w-[calc(100vw-32px)] -translate-x-1/2 animate-selection-bar-in items-center gap-1.5 rounded-[14px] border bg-popover/92 p-1.5 shadow-[0_1px_2px_rgb(24_24_27/0.06),0_16px_40px_-12px_rgb(24_24_27/0.28)] backdrop-blur-[12px] max-md:right-3 max-md:bottom-3 max-md:left-3 max-md:max-w-none max-md:translate-none max-md:animate-selection-bar-in-mobile max-md:flex-wrap max-md:gap-0.5 dark:shadow-[0_16px_40px_-12px_rgb(0_0_0/0.7)]"
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
            <div aria-live="polite" className="flex flex-col leading-[1.25] whitespace-nowrap">
              <strong className="text-[13px] font-semibold">{selectedFiles.length} selected</strong>
              <small className="text-[11px] text-muted-foreground">
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
              <button
                className="rounded-[8px] px-[9px] py-[5px] text-[12px] font-medium whitespace-nowrap text-foreground hover:bg-accent max-md:ml-auto"
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
                  className={cn(
                    "h-9 gap-1.5 rounded-[9px] px-2.5 text-[12.5px] max-[1100px]:w-[38px] max-[1100px]:justify-center max-[1100px]:p-0 max-md:min-h-11 max-md:w-11 [&_svg]:text-muted-foreground hover:[&_svg]:text-foreground",
                    (a === "delete" || a === "permanent") &&
                      "text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/10 [&_svg]:text-destructive hover:[&_svg]:text-destructive"
                  )}
                  onClick={() => action(a as string, selectedFiles)}
                >
                  <I />
                  <span className="max-[1100px]:hidden">{label as string}</span>
                </Button>
              );
            })}
          </div>
        </div>
      )}
      {folders.length > 0 && screen !== "trash" && (
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
              New folder <PlusIcon />
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
                    {menu(f, {
                      mobile:
                        "h-[23px]! w-5! text-muted-foreground hover:text-muted-foreground aria-expanded:text-muted-foreground max-md:min-h-9",
                    })}
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
      <section className="min-w-0" onClick={clearOnBackground}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-[9px] text-[13px] font-[550] md:text-[14px]">
            {screen === "trash"
              ? "Deleted files"
              : query.search
                ? "Search results"
                : screen === "recent"
                  ? "Recently opened"
                  : query.folder
                    ? "Files"
                    : "All files"}{" "}
            <span className="text-[10px] font-normal text-muted-foreground">
              {(screen === "trash" ? files.length : documents.length).toString().padStart(2, "0")}
            </span>
          </h2>
          <span className="text-[11px] text-muted-foreground max-md:hidden">
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
          <Table className="[&_[data-slot=table-cell]]:h-[54px] [&_[data-slot=table-cell]]:px-2! [&_[data-slot=table-cell]]:py-2.5 [&_[data-slot=table-cell]]:text-[11px] max-md:[&_[data-slot=table-cell]]:h-14 [&_[data-slot=table-head]]:h-9 [&_[data-slot=table-head]]:bg-sidebar [&_[data-slot=table-head]]:px-2! [&_[data-slot=table-head]]:py-2.5 [&_[data-slot=table-head]]:text-[11px] [&_[data-slot=table-head]]:font-normal [&_[data-slot=table-head]]:text-muted-foreground">
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
                      className="flex items-center gap-2.5 text-left text-[12px]"
                      onClick={() => screen !== "trash" && open(f)}
                    >
                      <FileIcon
                        file={f}
                        className="data-[kind=folder]:[&_svg]:h-[22px] data-[kind=folder]:[&_svg]:w-6"
                      />
                      {f.name}
                      {f.starred && <Star className="size-3.5 text-warning" />}
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
                    <span className="flex items-center gap-[7px]">
                      <PersonAvatar name={f.owner} className="size-[23px]!" />
                      {f.owner.split(" ")[0]}
                    </span>
                  </TableCell>
                  <TableCell>
                    {formatShortDate((screen === "trash" ? f.deletedAt : undefined) || f.modified)}
                  </TableCell>
                  <TableCell>{menu(f)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
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
                      {menu(f, { mobile: cardAction, desktop: cardAction })}
                    </div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-48">{menus(f, true)}</ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        )}
        {pageCount > 1 && (
          <div className="mt-[25px] flex items-center justify-center gap-[18px] text-[12px]">
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
      <div className="mt-5 flex items-center justify-between border-t pt-4 text-[9px] text-muted-foreground md:text-[10px]">
        <span>{files.length} items</span>
        <span>
          <span className="mr-[5px] rounded-[3px] border px-1 py-0.5">⌘ K</span> to find anything,
          fast
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
            <dl className="flex flex-col gap-4 text-[12px]">
              {Object.entries({
                Type: dialog.files[0].kind,
                Size: formatSize(dialog.files[0].size),
                Owner: dialog.files[0].owner,
                Modified: formatFullTimestamp(dialog.files[0].modified),
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
                <div key={k} className="flex justify-between gap-5">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right wrap-break-word">{v}</dd>
                </div>
              ))}
            </dl>
          ) : dialog?.kind === "history" ? (
            <div className="flex items-start gap-3 py-[18px] text-[13px]">
              <History />
              <div>
                <strong>Current version</strong>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {dialog.files[0].owner} · {formatMediumDate(dialog.files[0].modified)}
                </p>
                <small className="mt-2 text-[11px] text-muted-foreground">
                  Version tracking requires a connected backend.
                </small>
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
