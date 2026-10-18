"use client";

import type { BrowserDialog, DriveFile, FileBrowserActionOptions } from "@/types";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useActionGuard } from "@/hooks/use-action-guard";
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
import { downloadFile } from "../download";
import { copyFileLink } from "../remote-url";

export function useFileBrowserActions({
  drive,
  base,
  open,
  clearSelection,
}: FileBrowserActionOptions) {
  const router = useRouter();
  const [dialog, setDialog] = useState<BrowserDialog | null>(null);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("root");
  const [confirm, setConfirm] = useState<string[] | null>(null);
  // One guard for menus, keyboard actions, dialogs, and the selection bar.
  const mutation = useActionGuard();
  async function trash(ids: string[]) {
    const result = await mutation.run(() => drive.run(trashItems(ids)));
    if (!result?.ok) return;
    clearSelection();
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
          if (result.ok) clearSelection();
        });
        return;
      case "unlock":
        void mutation.run(async () => {
          const result = await drive.run(unlockItems(ids), "Moved to My Drive (still private)");
          if (result.ok) clearSelection();
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
    clearSelection();
  }
  return {
    dialog,
    setDialog,
    name,
    setName,
    target,
    setTarget,
    confirm,
    setConfirm,
    busy: mutation.pending,
    action,
    commit,
    trash,
  };
}
