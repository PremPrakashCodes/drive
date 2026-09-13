"use client";

import { FolderLock } from "lucide-react";
import { useId, useState } from "react";

import { FileBrowser } from "@/components/files/file-browser";
import { PinInput } from "@/components/files/pin-input";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/store";
import {
  resetLockedFolderPin,
  setUpLockedFolder,
  unlockLockedFolder,
} from "@/lib/drive/locked-folder";

// The Locked folder page: set up a PIN, enter it, or browse once unlocked.
export function LockedFolder() {
  const { drive } = useWorkspace();
  const listing = drive.listing;
  // FileBrowser renders the loading skeleton until the listing arrives.
  if (!listing) return <FileBrowser />;
  const { hasPin, expiresIn } = listing.lockedFolder;
  if (hasPin && expiresIn !== null) return <FileBrowser />;
  return <PinGate key={`${listing.workspace.id}:${hasPin}`} hasPin={hasPin} />;
}

function PinGate({ hasPin }: { hasPin: boolean }) {
  const { drive } = useWorkspace();
  const passwordId = useId();
  const [mode, setMode] = useState<"unlock" | "setup" | "reset">(hasPin ? "unlock" : "setup");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const choosing = mode !== "unlock";
  const mismatch = choosing && confirm.length === 6 && pin !== confirm;
  const ready =
    pin.length === 6 && (!choosing || pin === confirm) && (mode !== "reset" || password.length > 0);

  async function submit(value = pin) {
    setBusy(true);
    const result = await drive.run(
      mode === "unlock"
        ? unlockLockedFolder(value)
        : mode === "setup"
          ? setUpLockedFolder(value)
          : resetLockedFolderPin({ accountPassword: password, pin: value }),
      mode === "setup"
        ? "Your Locked folder is ready"
        : mode === "reset"
          ? "New PIN saved"
          : undefined
    );
    setBusy(false);
    if (!result.ok && mode === "unlock") setPin("");
  }

  return (
    <Empty className="min-h-[60vh]">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderLock />
        </EmptyMedia>
        <EmptyTitle>
          {mode === "setup"
            ? "Set up your Locked folder"
            : mode === "reset"
              ? "Choose a new PIN"
              : "Locked folder"}
        </EmptyTitle>
        <EmptyDescription>
          {mode === "setup"
            ? "Files you move here are hidden from My Drive, search, and everyone else in this drive. Choose a 6-digit PIN to open it."
            : mode === "reset"
              ? "Confirm your account password, then choose a new PIN. Your files stay locked."
              : "Enter your 6-digit PIN to see your hidden files."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <form
          className="flex w-full max-w-xs flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready && !busy) void submit();
          }}
        >
          <FieldGroup>
            {mode === "reset" && (
              <Field>
                <FieldLabel htmlFor={passwordId}>Account password</FieldLabel>
                <Input
                  id={passwordId}
                  type="password"
                  required
                  autoFocus
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
            )}
            <PinInput
              label={choosing ? "New PIN" : "PIN"}
              value={pin}
              autoFocus={mode !== "reset"}
              onChange={(value) => {
                setPin(value);
                // Unlock as soon as the sixth digit is in.
                if (mode === "unlock" && value.length === 6 && !busy) void submit(value);
              }}
            />
            {choosing && <PinInput label="Confirm PIN" value={confirm} onChange={setConfirm} />}
            {mismatch && (
              <p role="alert" className="text-sm text-destructive">
                The PINs don&apos;t match.
              </p>
            )}
          </FieldGroup>
          <Button type="submit" disabled={!ready || busy}>
            {busy
              ? "Checking…"
              : mode === "unlock"
                ? "Unlock"
                : mode === "setup"
                  ? "Create PIN"
                  : "Save new PIN"}
          </Button>
          {hasPin && (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => {
                setMode(mode === "reset" ? "unlock" : "reset");
                setPin("");
                setConfirm("");
                setPassword("");
              }}
            >
              {mode === "reset" ? "Back to PIN" : "Forgot your PIN?"}
            </Button>
          )}
        </form>
        <p className="text-xs text-muted-foreground">
          Only you can open it. It locks again after 15 minutes without activity, or when you close
          the browser.
        </p>
      </EmptyContent>
    </Empty>
  );
}
