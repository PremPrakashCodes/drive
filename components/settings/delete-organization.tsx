"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { findOrganization, useWorkspace } from "@/components/workspace/store";
import { deleteOrganizationAction } from "@/lib/drive/org";
import { rowDescriptionClass, rowTitleClass } from "./styles";

// Owners can delete the open organization; everything in it goes too.
export function DeleteOrganization({ org }: { org: string }) {
  const { data, drive } = useWorkspace();
  const router = useRouter();
  const confirmId = useId();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const organization = findOrganization(data.organizations, org);
  if (organization?.role !== "owner") return null;
  return (
    <>
      <div className="flex items-center gap-3.5 border-t px-5 py-[18px] max-md:flex-col max-md:items-start max-md:gap-3 max-md:px-4">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-destructive/10 text-destructive max-md:hidden [&_svg]:size-4"
          aria-hidden="true"
        >
          <Trash2 />
        </span>
        <div className="min-w-0 flex-1">
          <strong className={rowTitleClass}>Delete this organization</strong>
          <p className={rowDescriptionClass}>
            Permanently delete {organization.name} with its teams, members and every file in it.
          </p>
        </div>
        <Button
          variant="destructive"
          onClick={() => {
            setConfirm("");
            setOpen(true);
          }}
        >
          Delete organization
        </Button>
      </div>
      <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {organization.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This can&apos;t be undone. Every file is removed from the connected bucket, and all
              members lose access right away.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel htmlFor={confirmId}>Type {organization.name} to confirm</FieldLabel>
            <Input
              id={confirmId}
              value={confirm}
              autoComplete="off"
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending || confirm.trim() !== organization.name}
              onClick={async () => {
                setPending(true);
                const result = await deleteOrganizationAction(org, confirm);
                setPending(false);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                setOpen(false);
                toast.success(`${organization.name} was deleted`);
                router.replace("/");
                void drive.reload();
              }}
            >
              {pending ? "Deleting…" : "Delete organization"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
