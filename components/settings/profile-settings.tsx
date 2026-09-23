"use client";

import { Building2, Mail, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonAvatar } from "@/components/workspace/common";
import { useWorkspaceRoute } from "@/components/workspace/route";
import { findOrganization, useWorkspace } from "@/components/workspace/store";
import { DemoNote, SettingsHeading } from "./settings-card";
import { cardBodyClass, cardClass, cardGridClass, stackClass } from "./styles";

// Account (your profile) or General (the open organization's profile).
export function ProfileSettings() {
  const { data, user, loaded } = useWorkspace();
  const { org } = useWorkspaceRoute();
  // The organization's name comes from the workspace store, which is empty on
  // a direct load of this page. The form below seeds its field once, on mount,
  // so rendering it early showed a blank "Organization name" that never
  // recovered when the data arrived — and offered to save that blank over it.
  // Wait for the store instead, the way the family page does.
  if (org && !loaded)
    return (
      <div className={stackClass}>
        <Skeleton className="h-16 w-80" />
        <Skeleton className="h-64" />
      </div>
    );
  const organization = org ? findOrganization(data.organizations, org) : undefined;
  return (
    <ProfileForm
      org={Boolean(org)}
      // Remount when the open organization changes, so the field follows it.
      key={organization?.id ?? "personal"}
      name={String((org ? organization?.name : user.name) || "")}
      email={user.email}
      fallbackName={user.name}
    />
  );
}

function ProfileForm({
  org,
  name: initialName,
  email: initialEmail,
  fallbackName,
}: {
  org: boolean;
  name: string;
  email: string;
  fallbackName: string;
}) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [saved, setSaved] = useState({ name: initialName, email: initialEmail });
  const dirty = name !== saved.name || email !== saved.email;
  return (
    <>
      <SettingsHeading
        title={org ? "Organization profile" : "Your profile"}
        description={
          org
            ? "The details that bring your team together."
            : "A few details that make this workspace yours."
        }
      />
      <form
        className={cardClass}
        aria-labelledby="profile-card-title"
        onSubmit={(e) => {
          e.preventDefault();
          setSaved({ name, email });
          toast.success("Profile details are shown from your account");
        }}
      >
        <header className="flex items-center gap-3.5 border-b bg-[color-mix(in_srgb,var(--muted)_40%,var(--card))] p-5 max-md:flex-wrap max-md:p-4">
          <PersonAvatar
            name={name.trim() || fallbackName}
            className="size-13! shadow-[0_0_0_3px_var(--card),0_0_0_4px_var(--border)] **:data-[slot=avatar-fallback]:text-[17px]! **:data-[slot=avatar-fallback]:font-medium!"
          />
          <div className="min-w-0">
            <h3
              id="profile-card-title"
              className="truncate text-[16px] font-semibold tracking-[-0.2px]"
            >
              {name.trim() || "Unnamed"}
            </h3>
            <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{email}</p>
          </div>
          <Badge variant="secondary" className="ml-auto shrink-0 max-md:ml-0">
            {org ? <Building2 /> : <UserRound />}
            {org ? "Organization" : "Personal workspace"}
          </Badge>
        </header>
        <div className={cardBodyClass}>
          <FieldGroup className={cardGridClass}>
            <Field>
              <FieldLabel htmlFor="profile-name">
                {org ? "Organization name" : "Full name"}
              </FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="profile-name"
                  autoComplete={org ? "organization" : "name"}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <InputGroupAddon>{org ? <Building2 /> : <UserRound />}</InputGroupAddon>
              </InputGroup>
              <FieldDescription>
                {org ? "Shown to members and in shared links." : "How collaborators see you."}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="profile-email">
                {org ? "Contact email" : "Email address"}
              </FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="profile-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <InputGroupAddon>
                  <Mail />
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>
                {org ? "Where members can reach an admin." : "Used for notifications, not sign-in."}
              </FieldDescription>
            </Field>
          </FieldGroup>
        </div>
        <footer className="flex items-center justify-between gap-4 border-t bg-[color-mix(in_srgb,var(--muted)_60%,var(--card))] py-3 pr-4 pl-5 max-md:flex-col max-md:items-stretch max-md:px-4">
          <DemoNote>Demo profile only; sign-in details are unchanged.</DemoNote>
          <div className="flex shrink-0 gap-1.5 max-md:justify-end">
            {dirty && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setName(saved.name);
                  setEmail(saved.email);
                }}
              >
                Discard
              </Button>
            )}
            <Button type="submit" disabled={!dirty}>
              Save changes
            </Button>
          </div>
        </footer>
      </form>
    </>
  );
}
