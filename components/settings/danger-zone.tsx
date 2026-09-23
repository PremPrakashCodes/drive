"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
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
import { useWorkspaceRoute } from "@/components/workspace/route";
import { useWorkspace } from "@/components/workspace/store";
import { useActionGuard } from "@/hooks/use-action-guard";
import { deleteItems } from "@/lib/drive/items";
import { DeleteOrganization } from "./delete-organization";
import { SettingsCard, SettingsHeading } from "./settings-card";
import { rowDescriptionClass, rowTitleClass } from "./styles";

export function DangerZone() {
  const { data, drive } = useWorkspace();
  const { org } = useWorkspaceRoute();
  const [open, setOpen] = useState(false);
  const emptying = useActionGuard();
  // The same set the Trash screen offers to empty: everything trashed in this
  // drive that this person may delete. Locked-folder items never reach the
  // trash, so they are not part of it.
  const trashed = data.files.filter((f) => f.trashed && f.canEdit && !f.locked);
  return (
    <>
      <SettingsHeading title="Danger zone" description="Changes here need a little extra care." />
      <SettingsCard className="border-[color-mix(in_srgb,var(--destructive)_35%,var(--border))]">
        <div className="flex items-center gap-3.5 px-5 py-4.5 max-md:flex-col max-md:items-start max-md:gap-3 max-md:px-4">
          <span
            className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-destructive/10 text-destructive max-md:hidden [&_svg]:size-4"
            aria-hidden="true"
          >
            <RotateCcw />
          </span>
          <div className="min-w-0 flex-1">
            <strong className={rowTitleClass}>Empty the trash</strong>
            <p className={rowDescriptionClass}>
              Permanently delete everything currently in this workspace&apos;s trash.
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => {
              if (!trashed.length) {
                toast.info("The trash is already empty");
                return;
              }
              setOpen(true);
            }}
          >
            Empty trash
          </Button>
        </div>
        {org && <DeleteOrganization org={org} />}
      </SettingsCard>
      <AlertDialog open={open} onOpenChange={(next) => !emptying.pending && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Permanently delete {trashed.length} item{trashed.length === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Everything in this drive&apos;s trash is removed from storage for everyone. This
              can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={emptying.pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={emptying.pending}
              onClick={async () => {
                const result = await emptying.run(() =>
                  drive.run(deleteItems(trashed.map((f) => f.id)), "Trash emptied")
                );
                // A failure keeps the dialog open, with the error on screen.
                if (!result?.ok) return;
                setOpen(false);
              }}
            >
              {emptying.pending ? "Emptying…" : "Empty trash"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
