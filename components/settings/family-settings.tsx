"use client";

import type { Family, FamilyMember } from "@/lib/drive/types";
import {
  Crown,
  Eye,
  FolderPlus,
  Info,
  Lock,
  LogOut,
  Mail,
  Send,
  ShieldCheck,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonAvatar } from "@/components/workspace/common";
import { useWorkspace } from "@/components/workspace/store";
import { formatShortDate } from "@/lib/date";
import {
  cancelInvitation,
  getFamily,
  inviteMember,
  leaveWorkspace,
  removeMember,
} from "@/lib/drive/members";

const rules = [
  [Eye, "Shared by default", "New files and folders are visible to everyone in the drive."],
  [
    FolderPlus,
    "Everyone can add",
    "Members upload files and create folders anywhere they can see.",
  ],
  [
    Lock,
    "Private stays private",
    "A private folder is visible only to the person who made it, not even the owner.",
  ],
  [
    ShieldCheck,
    "You change only your own files",
    "People can open each other's files, but only rename, move, or delete what they added.",
  ],
] as const;

export function FamilySettings() {
  const { drive } = useWorkspace();
  const [family, setFamily] = useState<Family | null>(null);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  // Kept after closing so the dialog text doesn't blank out while it animates away.
  const [removal, setRemoval] = useState<{
    open: boolean;
    member?: FamilyMember;
  }>({ open: false });
  const [leaving, setLeaving] = useState(false);
  const spaceId = drive.listing?.workspace.id;
  const load = useCallback(async () => {
    const result = await getFamily();
    if (result.ok) setFamily(result.data);
    else toast.error(result.error);
  }, []);
  // Reload when switching drives. State is set once the request resolves.
  /* eslint-disable react-hooks/set-state-in-effect -- Loads server data for the open drive. */
  useEffect(() => {
    if (drive.active && spaceId) void load();
  }, [drive.active, spaceId, load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!drive.active)
    return (
      <>
        <div className="settings-section-heading">
          <h2>Family & members</h2>
          <p>Share your drive with the people you live with.</p>
        </div>
        <Empty className="settings-card developer-empty">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserPlus />
            </EmptyMedia>
            <EmptyTitle>Sign in to share your drive</EmptyTitle>
            <EmptyDescription>
              Family sharing needs an account, so invitations and files reach the right people.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </>
    );
  if (!family)
    return (
      <div className="settings-stack">
        <Skeleton className="h-16 w-80" />
        <Skeleton className="h-40" />
        <Skeleton className="h-52" />
      </div>
    );

  const owner = family.workspace.role === "owner";
  return (
    <>
      <div className="settings-section-heading">
        <h2>
          {owner ? "Share your drive with family" : `You're a member of ${family.workspace.name}`}
        </h2>
        <p>
          {owner
            ? "Invite the people you live with. They'll see what you share, add their own files, and keep a private space of their own."
            : "You can see what's shared, add your own files, and keep private folders only you can open."}
        </p>
      </div>
      <div className="settings-stack">
        {owner && (
          <section className="settings-card" aria-labelledby="family-invite-title">
            <header className="settings-card-header">
              <h3 id="family-invite-title">Invite someone</h3>
              <p>
                They get an email link and join as a member. Only you can invite or remove people.
              </p>
            </header>
            <form
              className="family-invite"
              onSubmit={async (e) => {
                e.preventDefault();
                setInviting(true);
                const result = await drive.run(
                  inviteMember(email),
                  `Invitation sent to ${email.trim()}`
                );
                setInviting(false);
                if (!result.ok) return;
                setEmail("");
                void load();
              }}
            >
              <Input
                type="email"
                required
                autoComplete="off"
                aria-label="Email address to invite"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" disabled={inviting}>
                <Send />
                {inviting ? "Sending…" : "Send invite"}
              </Button>
            </form>
          </section>
        )}
        <section className="settings-card" aria-labelledby="family-members-title">
          <header className="settings-card-header">
            <h3 id="family-members-title">People in this drive</h3>
            <p>
              {family.members.length} {family.members.length === 1 ? "person" : "people"}
            </p>
          </header>
          {family.members.map((m) => (
            <div className="setting-row" key={m.id}>
              <PersonAvatar name={m.name} className="size-8" />
              <div className="setting-row-text">
                <strong>
                  {m.name}
                  {m.you && " (you)"}
                </strong>
                <p>{m.email}</p>
              </div>
              {m.role === "owner" ? (
                <Badge variant="secondary">
                  <Crown />
                  Owner
                </Badge>
              ) : owner ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRemoval({ open: true, member: m })}
                >
                  <UserMinus />
                  Remove
                </Button>
              ) : (
                <Badge variant="outline">Member</Badge>
              )}
            </div>
          ))}
        </section>
        {owner && family.invitations.length > 0 && (
          <section className="settings-card" aria-labelledby="family-pending-title">
            <header className="settings-card-header">
              <h3 id="family-pending-title">Pending invitations</h3>
              <p>Waiting for them to accept.</p>
            </header>
            {family.invitations.map((i) => (
              <div className="setting-row" key={i.id}>
                <span className="setting-icon" aria-hidden="true">
                  <Mail />
                </span>
                <div className="setting-row-text">
                  <strong>{i.email}</strong>
                  <p>Expires {formatShortDate(i.expiresAt)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const result = await drive.run(cancelInvitation(i.id), "Invitation cancelled");
                    if (result.ok) void load();
                  }}
                >
                  Cancel
                </Button>
              </div>
            ))}
          </section>
        )}
        <section className="settings-card" aria-labelledby="family-rules-title">
          <header className="settings-card-header">
            <h3 id="family-rules-title">How sharing works</h3>
            <p>The same rules apply to everyone, including you.</p>
          </header>
          {rules.map(([Icon, title, description]) => (
            <div className="setting-row" key={title}>
              <span className="setting-icon" aria-hidden="true">
                <Icon />
              </span>
              <div className="setting-row-text">
                <strong>{title}</strong>
                <p>{description}</p>
              </div>
            </div>
          ))}
        </section>
        {!owner && (
          <section className="settings-card danger-card">
            <div className="setting-row">
              <span className="setting-icon" aria-hidden="true">
                <LogOut />
              </span>
              <div className="setting-row-text">
                <strong>Leave this drive</strong>
                <p>Files you shared stay here. Your private files in this drive are deleted.</p>
              </div>
              <Button variant="destructive" onClick={() => setLeaving(true)}>
                Leave drive
              </Button>
            </div>
          </section>
        )}
      </div>
      {owner && (
        <p className="demo-note mt-4">
          <Info className="size-3.5" />
          Invitations expire after 48 hours. You can send a new one anytime.
        </p>
      )}
      <AlertDialog open={removal.open} onOpenChange={(open) => setRemoval((r) => ({ ...r, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removal.member?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They lose access right away. Files they shared stay in the drive; their private files
              here are deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                const member = removal.member;
                if (!member) return;
                const result = await drive.run(
                  removeMember(member.id),
                  `${member.name} was removed`
                );
                setRemoval((r) => ({ ...r, open: false }));
                if (result.ok) void load();
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={leaving} onOpenChange={setLeaving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {family.workspace.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll lose access to everything shared here, and your private files in this
              drive are deleted. The owner can invite you again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                const result = await drive.run(leaveWorkspace(), "You left the drive");
                setLeaving(false);
                if (result.ok) setFamily(null);
              }}
            >
              Leave drive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
