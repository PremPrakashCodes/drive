"use client";

import { Building2, Globe, Info, Link, Lock, Users } from "lucide-react";
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
import { type DriveFile } from "@/lib/workspace/data";

// Stored as `tab` so saved demo settings keep their existing shape.
type Access = "people" | "teams" | "organization" | "link";

export function ShareDialog({ files, onClose }: { files: DriveFile[]; onClose: () => void }) {
  const { data, update, user } = useWorkspace();
  const { workspace } = useWorkspaceRoute();
  const teams = data.teams.filter((t) => t.workspace === workspace);
  const organization = data.organizations.find((o) => o.id === workspace);
  const personal = workspace === "personal";
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState("Viewer");
  const [access, setAccess] = useState<Access>("people");
  const [team, setTeam] = useState(teams[0]?.id ?? "");
  const inherited = files[0]?.team
    ? data.teams.find((t) => t.id === files[0].team)?.name
    : undefined;

  const accessOptions = [
    { label: "Restricted", value: "people" },
    ...(personal
      ? []
      : [
          ...(teams.length ? [{ label: "Team", value: "teams" }] : []),
          { label: organization?.name ?? "Organization", value: "organization" },
        ]),
    { label: "Anyone with the link", value: "link" },
  ];
  const accessDetail = {
    people: "Only people with access can open with the link",
    teams: "Everyone in the selected team can open",
    organization: `Anyone in ${organization?.name ?? "this organization"} can open`,
    link: "Anyone on the internet with the link can view",
  }[access];
  const AccessIcon = {
    people: Lock,
    teams: Users,
    organization: Building2,
    link: Globe,
  }[access];

  function save() {
    const emails = email.split(/[;,\s]+/).filter(Boolean);
    if (!emails.every((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))) {
      toast.error("Enter valid email addresses");
      return;
    }
    update((d) => ({
      ...d,
      files: d.files.map((f) => (files.some((i) => i.id === f.id) ? { ...f, shared: true } : f)),
      preferences: {
        ...d.preferences,
        ...Object.fromEntries(
          files.map((f) => [
            `share:${f.id}`,
            JSON.stringify({
              email,
              permission,
              tab: access,
              team,
              publicLink: access === "link",
            }),
          ])
        ),
      },
    }));
    toast.success(
      emails.length
        ? `Shared with ${emails.length} ${emails.length === 1 ? "person" : "people"}`
        : "Sharing settings saved"
    );
    onClose();
  }

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

        <div className="share-add">
          <Input
            aria-label="Add people by email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            placeholder="Add people by email"
          />
          <Choice
            label="Permission for people you add"
            value={permission}
            onChange={setPermission}
            options={["Viewer", "Editor", "Manager"]}
          />
        </div>

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
          {!personal && (
            <div className="share-person">
              <span className="share-icon">
                <Users />
              </span>
              <div>
                <strong>{inherited || "Organization members"}</strong>
                <small>Inherited from {inherited ? "team" : "organization"}</small>
              </div>
              <span>Editor</span>
            </div>
          )}
        </section>

        <section className="share-section">
          <h3>General access</h3>
          <div className="share-access">
            <span className="share-icon" data-public={access === "link" || undefined}>
              <AccessIcon />
            </span>
            <div>
              <div className="share-access-choices">
                <Choice
                  label="General access"
                  value={access}
                  onChange={(v) => setAccess(v as Access)}
                  options={accessOptions}
                  className="share-access-trigger"
                />
                {access === "teams" && (
                  <Choice
                    label="Team"
                    value={team}
                    onChange={setTeam}
                    options={teams.map((t) => ({ label: t.name, value: t.id }))}
                    className="share-access-trigger"
                  />
                )}
              </div>
              <small>{accessDetail}</small>
            </div>
          </div>
        </section>

        <p className="share-note">
          <Info />
          Demo only: settings stay on this device, no invitations are sent, and links don’t grant
          access.
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
          <Button onClick={save}>{email.trim() ? "Share" : "Done"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
