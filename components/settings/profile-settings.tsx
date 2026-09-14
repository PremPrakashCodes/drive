"use client";

import { Building2, Earth, Languages, Mail, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Choice, PersonAvatar } from "@/components/workspace/common";
import { useWorkspaceRoute } from "@/components/workspace/route";
import { findOrganization, useWorkspace } from "@/components/workspace/store";
import { usePreference } from "./preference-row";
import { DemoNote, SettingsCard, SettingsHeading } from "./settings-card";
import { cardBodyClass, cardClass, cardGridClass, fieldLabelIconClass } from "./styles";

// Account (your profile) or General (the open organization's profile).
export function ProfileSettings() {
  const { data, user } = useWorkspace();
  const { org } = useWorkspaceRoute();
  const { pref, set } = usePreference();
  const [name, setName] = useState(
    String((org ? findOrganization(data.organizations, org)?.name : user.name) || "")
  );
  const [email, setEmail] = useState(String(pref("email") || user.email));
  const [saved, setSaved] = useState({ name, email });
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
            name={name.trim() || user.name}
            className="size-[52px]! shadow-[0_0_0_3px_var(--card),0_0_0_4px_var(--border)] [&_[data-slot=avatar-fallback]]:text-[17px]! [&_[data-slot=avatar-fallback]]:font-medium!"
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
      <SettingsCard
        className="mt-4"
        title="Language & region"
        description="Changes apply right away."
      >
        <div className={cardBodyClass}>
          <FieldGroup className={cardGridClass}>
            <Field>
              <FieldLabel>
                <Languages className={fieldLabelIconClass} />
                Language
              </FieldLabel>
              <Choice
                label="Language"
                className="w-full"
                value={String(pref("language") || "English")}
                onChange={(v) => {
                  set("language", v);
                  toast.success("Language updated");
                }}
                options={["English", "Hindi", "French", "German"]}
              />
            </Field>
            <Field>
              <FieldLabel>
                <Earth className={fieldLabelIconClass} />
                Timezone
              </FieldLabel>
              <Choice
                label="Timezone"
                className="w-full"
                value={String(pref("timezone") || "Asia/Kolkata")}
                onChange={(v) => {
                  set("timezone", v);
                  toast.success("Timezone updated");
                }}
                options={["Asia/Kolkata", "America/New_York", "Europe/London", "UTC"]}
              />
            </Field>
          </FieldGroup>
        </div>
      </SettingsCard>
    </>
  );
}
