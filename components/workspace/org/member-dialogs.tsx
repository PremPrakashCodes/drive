"use client";

import type { DriveMember, DriveTeam } from "@/types";
import { useQueryState } from "nuqs";
import { useState } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/components/workspace/store";
import { inviteMembers, removeOrgMember } from "@/lib/drive/org";
import { Choice } from "../common";

// Opened by the `invite` URL param, so other pages can link straight to it.
export function InviteMembersDialog({
  org,
  teams,
  teamOnly,
  reload,
}: {
  org: string;
  teams: DriveTeam[];
  teamOnly?: string;
  reload: () => Promise<void>;
}) {
  const { drive } = useWorkspace();
  const [invite, setInvite] = useQueryState("invite");
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState("member");
  const [team, setTeam] = useState(teamOnly ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={invite === "true"}
      onOpenChange={(o) => {
        if (!o) void setInvite(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite your people</DialogTitle>
          <DialogDescription>
            They&apos;ll get an email with a link to join this organization.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            try {
              const result = await drive.run(
                inviteMembers(org, { emails, role, teamId: team || undefined }),
                "Invitations sent",
                reload
              );
              if (!result.ok) return;
              void setInvite(null);
              setEmails("");
            } finally {
              setBusy(false);
            }
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="invite-emails">Email addresses</FieldLabel>
              <Textarea
                id="invite-emails"
                required
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                placeholder="name@example.com, another@example.com"
              />
            </Field>
            <Field>
              <FieldLabel>Role</FieldLabel>
              <Choice
                label="Invitation role"
                value={role}
                onChange={setRole}
                options={[
                  { label: "Member", value: "member" },
                  { label: "Admin", value: "admin" },
                ]}
              />
            </Field>
            <Field>
              <FieldLabel>Team (optional)</FieldLabel>
              <Choice
                label="Invitation team"
                value={team}
                onChange={setTeam}
                options={[
                  { label: "No team", value: "" },
                  ...teams.map((t) => ({ value: t.id, label: t.name })),
                ]}
              />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send invitations"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RemoveMemberDialog({
  org,
  member,
  onClose,
  reload,
}: {
  org: string;
  member: DriveMember | null;
  onClose: () => void;
  reload: () => Promise<void>;
}) {
  const { drive } = useWorkspace();
  return (
    <AlertDialog
      open={!!member}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this member?</AlertDialogTitle>
          <AlertDialogDescription>
            They lose access to this organization. Their private files are removed with them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              if (member) void drive.run(removeOrgMember(org, member.id), "Member removed", reload);
              onClose();
            }}
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
