"use client";

import { FolderLock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PinInput } from "@/components/files/pin-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { useWorkspaceRoute } from "@/components/workspace/route";
import { useWorkspace } from "@/components/workspace/store";
import { changeLockedFolderPin } from "@/lib/drive/locked-folder";

// Settings → Security: the Locked folder's PIN for the open drive.
export function LockedFolderSettings() {
  const { drive } = useWorkspace();
  const { prefix } = useWorkspaceRoute();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const listing = drive.listing;
  if (!drive.active || !listing) return null;
  const { hasPin } = listing.lockedFolder;
  const mismatch = confirm.length === 6 && pin !== confirm;

  return (
    <>
      <section
        className="overflow-hidden rounded-[14px] border bg-card"
        aria-labelledby="locked-folder-title"
      >
        <header className="border-b px-5 py-4 max-md:px-4">
          <h3 id="locked-folder-title" className="text-[14px] font-medium">
            Locked folder
          </h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Hide files behind a 6-digit PIN. Only you can open it, not other people in this drive.
          </p>
        </header>
        <div className="flex items-center gap-3.5 px-5 py-3.5 max-md:gap-3 max-md:px-4 max-md:py-3 [&+&]:border-t">
          <span
            className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-muted text-muted-foreground max-md:hidden [&_svg]:size-4"
            aria-hidden="true"
          >
            <FolderLock />
          </span>
          <div className="min-w-0 flex-1">
            <strong className="block text-[13px] font-medium">
              {hasPin ? "PIN is set" : "Not set up yet"}
            </strong>
            <p className="mt-0.5 text-[12px] leading-[1.5] text-muted-foreground">
              {hasPin
                ? "Locks again after 15 minutes without activity."
                : "You'll choose a PIN the first time you open it."}
            </p>
          </div>
          {hasPin ? (
            <Button
              variant="outline"
              onClick={() => {
                setCurrent("");
                setPin("");
                setConfirm("");
                setOpen(true);
              }}
            >
              Change PIN
            </Button>
          ) : (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`${prefix}/locked`} />}
            >
              Set up
            </Button>
          )}
        </div>
      </section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (pin !== confirm) return;
              setBusy(true);
              const result = await drive.run(
                changeLockedFolderPin({ current, pin }),
                "PIN changed"
              );
              setBusy(false);
              if (result.ok) setOpen(false);
            }}
          >
            <DialogHeader>
              <DialogTitle>Change Locked folder PIN</DialogTitle>
              <DialogDescription>Your other devices will ask for the new PIN.</DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-4">
              <PinInput label="Current PIN" value={current} onChange={setCurrent} autoFocus />
              <PinInput label="New PIN" value={pin} onChange={setPin} />
              <PinInput label="Confirm new PIN" value={confirm} onChange={setConfirm} />
              {mismatch && (
                <p role="alert" className="text-sm text-destructive">
                  The new PINs don&apos;t match.
                </p>
              )}
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={busy || current.length !== 6 || pin.length !== 6 || pin !== confirm}
              >
                {busy ? "Saving…" : "Change PIN"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
