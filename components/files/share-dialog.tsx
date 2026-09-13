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
import { setVisibility } from "@/lib/drive/items";
import { inviteMembers } from "@/lib/drive/org";
import { type DriveFile } from "@/lib/workspace/data";

export function ShareDialog({ files, onClose }: { files: DriveFile[]; onClose: () => void }) {
  const { data, user, drive } = useWorkspace();
  const { org } = useWorkspaceRoute();
  const organization = org
    ? data.organizations.find((o) => o.slug === org || o.id === org)
    : undefined;
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const canManage = drive.active && files.every((f) => f.canEdit);

  async function save() {
    if (!drive.active || !files.length) {
      onClose();
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const emails = email.split(/[;,\s]+/).filter(Boolean);
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
    if (!drive.active || !canManage || busy) return;
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
      <DialogContent className="share-dialog">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">
            Share {files.length === 1 ? `“${files[0].name}”` : `${files.length} files`}
          </DialogTitle>
          <DialogDescription>Bring the right people into your work.</DialogDescription>
        </DialogHeader>

        {org && organization && (
          <div className="share-add">
            <Input
              aria-label="Add people by email"
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
            />
          </div>
        )}

        <section className="share-section">
          <h3>People with access</h3>
          <div className="share-person">
            <PersonAvatar name={user.name} />
            <div>
              <strong>{user.name} (you)</strong>
              <small>{user.email}</small>
            </div>
            <span>Owner</span>
          </div>
          {org && organization && (
            <div className="share-person">
              <span className="share-icon">
                <Users />
              </span>
              <div>
                <strong>{organization.name} members</strong>
                <small>Everyone in the organization</small>
              </div>
              <span>Editor</span>
            </div>
          )}
        </section>

        <section className="share-section">
          <h3>General access</h3>
          <div className="share-access">
            <span className="share-icon">
              <AccessIcon />
            </span>
            <div>
              <div className="share-access-choices">
                <Choice
                  label="General access"
                  value={files[0]?.visibility === "shared" ? "Shared" : "Restricted"}
                  onChange={(v) => void setAccess(v === "Shared")}
                  options={canManage ? ["Restricted", "Shared"] : ["Restricted"]}
                  className="share-access-trigger"
                />
              </div>
              <small>{accessDetail}</small>
            </div>
          </div>
        </section>

        <p className="share-note">
          <Info />
          {canManage
            ? "Members of this drive see shared files automatically. Private files stay visible only to you."
            : "You can only change sharing on files you added."}
        </p>

        <DialogFooter className="share-footer">
          <Button
            variant="outline"
            onClick={() =>
              navigator.clipboard
                .writeText(`${location.origin}${location.pathname}?preview=${files[0]?.id}`)
                .then(
                  () => toast.success("Link copied"),
                  () => toast.error("Clipboard access denied")
                )
            }
          >
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
