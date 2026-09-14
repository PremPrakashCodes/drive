"use client";

import { History } from "lucide-react";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Choice } from "@/components/workspace/common";
import { formatFullTimestamp, formatMediumDate } from "@/lib/date";
import { deleteItems } from "@/lib/drive/items";
import { accessLabel, formatSize } from "@/lib/workspace/data";
import { ShareDialog } from "../share-dialog";
import type { FileBrowserState } from "./use-file-browser";

// Share, rename/move/copy, info and history dialogs, and the delete confirmation.
export function BrowserDialogs({
  browser: {
    dialog,
    setDialog,
    workspace,
    byId,
    name,
    setName,
    target,
    setTarget,
    screen,
    data,
    commit,
    confirm,
    setConfirm,
    setSelected,
    drive,
  },
}: {
  browser: FileBrowserState;
}) {
  return (
    <>
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
                Location: `${workspace === "personal" ? "My Drive" : workspace} / ${(dialog.files[0].parent && byId.get(dialog.files[0].parent)?.name) || ""}`,
                Access: accessLabel(dialog.files[0]),
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
              The files are removed from storage for everyone. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                const result = await drive.run(
                  deleteItems(confirm || []),
                  "Items permanently deleted"
                );
                if (!result.ok) return;
                setConfirm(null);
                setSelected([]);
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
