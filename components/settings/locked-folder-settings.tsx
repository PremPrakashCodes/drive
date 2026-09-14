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
import { useWorkspace } from "@/components/workspace/store";
import { changeLockedFolderPin } from "@/lib/drive/locked-folder";
import {
  cardClass,
  cardDescriptionClass,
  cardHeaderClass,
  cardTitleClass,
  rowClass,
  rowDescriptionClass,
  rowIconClass,
  rowTitleClass,
} from "./styles";

// Settings → Security: the Locked folder's PIN for the open drive.
export function LockedFolderSettings() {
  const { drive } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const listing = drive.listing;
  if (!listing) return null;
  const { hasPin } = listing.lockedFolder;
  const mismatch = confirm.length === 6 && pin !== confirm;

  return (
    <>
      <section
        className={cardClass}
        aria-labelledby="locked-folder-title"
      >
        <header className={cardHeaderClass}>
          <h3 id="locked-folder-title" className={cardTitleClass}>
            Locked folder
          </h3>
          <p className={cardDescriptionClass}>
            Hide files behind a 6-digit PIN. Only you can open it, not other people in this drive.
          </p>
        </header>
        <div className={rowClass}>
          <span
            className={rowIconClass}
            aria-hidden="true"
          >
            <FolderLock />
          </span>
          <div className="min-w-0 flex-1">
            <strong className={rowTitleClass}>
              {hasPin ? "PIN is set" : "Not set up yet"}
            </strong>
            <p className={rowDescriptionClass}>
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
              render={<Link href="/locked" />}
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
