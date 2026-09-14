"use client";

import type { Family, FamilyMember } from "@/types";
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
  renameWorkspace,
} from "@/lib/drive/members";
import { cn } from "@/lib/utils";
import { DriveName } from "@/lib/workspace/names";
import {
  cardClass,
  cardDescriptionClass,
  cardHeaderClass,
  cardTitleClass,
  rowClass,
  rowDescriptionClass,
  rowIconClass,
  rowTitleClass,
  sectionDescriptionClass,
  sectionTitleClass,
  stackClass,
} from "./styles";

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
  const [driveName, setDriveName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const spaceId = drive.listing?.workspace.id;
  const load = useCallback(async () => {
    const result = await getFamily();
    if (result.ok) {
      setFamily(result.data);
      setDriveName(result.data.workspace.name);
    } else toast.error(result.error);
  }, []);
  // Reload when switching drives. State is set once the request resolves.
  /* eslint-disable react-hooks/set-state-in-effect -- Loads server data for the open drive. */
  useEffect(() => {
    if (spaceId) void load();
  }, [spaceId, load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!family)
    return (
      <div className={stackClass}>
        <Skeleton className="h-16 w-80" />
        <Skeleton className="h-40" />
        <Skeleton className="h-52" />
      </div>
    );

  const owner = family.workspace.role === "owner";
  return (
    <>
      <div className="mb-6.5">
        <h2 className={sectionTitleClass}>
          {owner ? "Share your drive with family" : `You're a member of ${family.workspace.name}`}
        </h2>
        <p className={sectionDescriptionClass}>
          {owner
            ? "Invite the people you live with. They'll see what you share, add their own files, and keep a private space of their own."
            : "You can see what's shared, add your own files, and keep private folders only you can open."}
        </p>
      </div>
      <div className={stackClass}>
        {owner && (
          <section className={cardClass} aria-labelledby="family-name-title">
            <header className={cardHeaderClass}>
              <h3 id="family-name-title" className={cardTitleClass}>
                Drive name
              </h3>
              <p className={cardDescriptionClass}>
                Shown in the workspace switcher and in invitations you send.
              </p>
            </header>
            <form
              className="flex gap-2 px-5 py-4 max-md:flex-col max-md:px-4 max-md:py-3.5"
              onSubmit={async (e) => {
                e.preventDefault();
                setRenaming(true);
                const result = await drive.run(renameWorkspace(driveName), "Drive renamed");
                setRenaming(false);
                if (result.ok) void load();
              }}
            >
              <Input
                required
                maxLength={DriveName.maxLength ?? undefined}
                autoComplete="off"
                aria-label="Drive name"
                placeholder="My drive"
                className="flex-1"
                value={driveName}
                onChange={(e) => setDriveName(e.target.value)}
              />
              <Button
                type="submit"
                disabled={
                  renaming || !driveName.trim() || driveName.trim() === family.workspace.name
                }
              >
                {renaming ? "Saving…" : "Save"}
              </Button>
            </form>
          </section>
        )}
        {owner && (
          <section className={cardClass} aria-labelledby="family-invite-title">
            <header className={cardHeaderClass}>
              <h3 id="family-invite-title" className={cardTitleClass}>
                Invite someone
              </h3>
              <p className={cardDescriptionClass}>
                They get an email link and join as a member. Only you can invite or remove people.
              </p>
            </header>
            <form
              className="flex gap-2 px-5 py-4 max-md:flex-col max-md:px-4 max-md:py-3.5"
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
                className="flex-1"
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
        <section className={cardClass} aria-labelledby="family-members-title">
          <header className={cardHeaderClass}>
            <h3 id="family-members-title" className={cardTitleClass}>
              People in this drive
            </h3>
            <p className={cardDescriptionClass}>
              {family.members.length} {family.members.length === 1 ? "person" : "people"}
            </p>
          </header>
          {family.members.map((m) => (
            <div className={rowClass} key={m.id}>
              <PersonAvatar name={m.name} />
              <div className="min-w-0 flex-1">
                <strong className={rowTitleClass}>
                  {m.name}
                  {m.you && " (you)"}
                </strong>
                <p className={rowDescriptionClass}>{m.email}</p>
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
          <section className={cardClass} aria-labelledby="family-pending-title">
            <header className={cardHeaderClass}>
              <h3 id="family-pending-title" className={cardTitleClass}>
                Pending invitations
              </h3>
              <p className={cardDescriptionClass}>Waiting for them to accept.</p>
            </header>
            {family.invitations.map((i) => (
              <div className={rowClass} key={i.id}>
                <span className={rowIconClass} aria-hidden="true">
                  <Mail />
                </span>
                <div className="min-w-0 flex-1">
                  <strong className={rowTitleClass}>{i.email}</strong>
                  <p className={rowDescriptionClass}>Expires {formatShortDate(i.expiresAt)}</p>
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
        <section className={cardClass} aria-labelledby="family-rules-title">
          <header className={cardHeaderClass}>
            <h3 id="family-rules-title" className={cardTitleClass}>
              How sharing works
            </h3>
            <p className={cardDescriptionClass}>The same rules apply to everyone, including you.</p>
          </header>
          {rules.map(([Icon, title, description]) => (
            <div className={rowClass} key={title}>
              <span className={rowIconClass} aria-hidden="true">
                <Icon />
              </span>
              <div className="min-w-0 flex-1">
                <strong className={rowTitleClass}>{title}</strong>
                <p className={rowDescriptionClass}>{description}</p>
              </div>
            </div>
          ))}
        </section>
        {!owner && (
          <section
            className={cn(
              cardClass,
              "border-[color-mix(in_srgb,var(--destructive)_35%,var(--border))]"
            )}
          >
            <div className="flex items-center gap-3.5 px-5 py-4.5 max-md:flex-col max-md:items-start max-md:gap-3 max-md:px-4">
              <span
                className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-destructive/10 text-destructive max-md:hidden [&_svg]:size-4"
                aria-hidden="true"
              >
                <LogOut />
              </span>
              <div className="min-w-0 flex-1">
                <strong className={rowTitleClass}>Leave this drive</strong>
                <p className={rowDescriptionClass}>
                  Files you shared stay here. Your private files in this drive are deleted.
                </p>
              </div>
              <Button variant="destructive" onClick={() => setLeaving(true)}>
                Leave drive
              </Button>
            </div>
          </section>
        )}
      </div>
      {owner && (
        <p className="mt-4 flex items-start gap-1.75 text-[11px] leading-[1.7] text-muted-foreground">
          <Info className="mt-0.75 size-3.5 shrink-0" />
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
