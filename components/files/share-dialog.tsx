"use client";

import { Info, Link, Lock, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Choice, PersonAvatar } from "@/components/workspace/common";
import { useWorkspaceRoute } from "@/components/workspace/route";
import { useWorkspace } from "@/components/workspace/store";
import { splitEmails } from "@/lib/auth-form";
import { setVisibility } from "@/lib/drive/items";
import { inviteMembers } from "@/lib/drive/org";
import type { DriveFile } from "@/types";
import { copyFileLink } from "./remote-url";

export function ShareDialog({ files, onClose }: { files: DriveFile[]; onClose: () => void }) {
  const { data, user, drive } = useWorkspace();
  const { org } = useWorkspaceRoute();
  const organization = org
    ? data.organizations.find((o) => o.slug === org || o.id === org)
    : undefined;
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const canManage = files.every((f) => f.canEdit);

  async function save() {
    if (!files.length) {
      onClose();
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const emails = splitEmails(email);
      if (emails.length) {
        if (!org) {
          // A personal drive shares through the family invitation flow.
          toast.info("Invite family members from Settings → Family & members.");
          return;
        }
        const result = await drive.run(
          inviteMembers(org, { emails: email, role: "member" }),
          `Invited ${emails.length === 1 ? "1 person" : `${emails.length} people`}`
        );
        if (!result.ok) return;
        setEmail("");
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  // Shared/private is the real lever: everything else is informational.
  async function setAccess(shared: boolean) {
    if (!canManage || busy) return;
    const target = files[0]?.visibility === "shared";
    if (target === shared) return;
    setBusy(true);
    try {
      for (const file of files) {
        const result = await setVisibility(file.id, shared ? "shared" : "private");
        if (!result.ok) {
          toast.error(result.error);
          break;
        }
      }
      await drive.reload();
      toast.success(shared ? "Shared with the drive" : "Only you can see this");
    } finally {
      setBusy(false);
    }
  }

  const accessDetail =
    files[0]?.visibility === "shared"
      ? `Everyone in ${organization?.name ?? "this drive"} can open it`
      : "Only you can open this file";
  const AccessIcon = files[0]?.visibility === "shared" ? Users : Lock;

  return (
    <Dialog
      open={files.length > 0}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="gap-4.5">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">
            Share {files.length === 1 ? `“${files[0].name}”` : `${files.length} files`}
          </DialogTitle>
          <DialogDescription>Bring the right people into your work.</DialogDescription>
        </DialogHeader>

        {org && organization && (
          <div className="flex gap-2">
            <Input
              aria-label="Add people by email"
              className="min-w-0 flex-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void save();
              }}
              placeholder="Add people by email"
            />
            <Choice
              label="Permission for people you add"
              value="Member"
              onChange={() => {}}
              options={["Member"]}
              className="min-w-24 shrink-0"
            />
          </div>
        )}

        <section>
          <h3 className="mb-1 text-[12px] font-medium">People with access</h3>
          <div className="flex items-center gap-2.5 py-2 text-[12px]">
            <PersonAvatar name={user.name} />
            <div className="flex min-w-0 flex-col gap-0.75">
              <strong className="font-medium">{user.name} (you)</strong>
              <small className="truncate text-[10px] text-muted-foreground">{user.email}</small>
            </div>
            <span className="ml-auto text-[11px] text-muted-foreground">Owner</span>
          </div>
          {org && organization && (
            <div className="flex items-center gap-2.5 py-2 text-[12px]">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                <Users className="size-4" />
              </span>
              <div className="flex min-w-0 flex-col gap-0.75">
                <strong className="font-medium">{organization.name} members</strong>
                <small className="truncate text-[10px] text-muted-foreground">
                  Everyone in the organization
                </small>
              </div>
              <span className="ml-auto text-[11px] text-muted-foreground">Editor</span>
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-1 text-[12px] font-medium">General access</h3>
          <div className="flex items-center gap-2.5 py-1.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
              <AccessIcon className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex flex-wrap gap-1">
                <Choice
                  label="General access"
                  value={files[0]?.visibility === "shared" ? "Shared" : "Restricted"}
                  onChange={(v) => void setAccess(v === "Shared")}
                  options={canManage ? ["Restricted", "Shared"] : ["Restricted"]}
                  className="-ml-1.5 border-transparent bg-transparent px-1.5 py-0.5 text-[12px] font-medium shadow-none hover:bg-muted focus-visible:border-transparent focus-visible:ring-0 data-[size=default]:h-auto dark:bg-transparent dark:hover:bg-muted"
                />
              </div>
              <small className="truncate text-[11px] text-muted-foreground">{accessDetail}</small>
            </div>
          </div>
        </section>

        <p className="flex items-start gap-2 rounded-[8px] bg-muted px-2.75 py-2.25 text-[11px] leading-normal text-muted-foreground">
          <Info className="mt-0.5 size-3.25 shrink-0" />
          {canManage
            ? "Members of this drive see shared files automatically. Private files stay visible only to you."
            : "You can only change sharing on files you added."}
        </p>

        <DialogFooter className="justify-between sm:justify-between">
          <Button variant="outline" onClick={() => files[0] && copyFileLink(files[0].id)}>
            <Link />
            Copy link
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? "Sharing…" : email.trim() ? "Share" : "Done"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
