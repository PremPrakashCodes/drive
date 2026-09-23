"use client";

import { Bell } from "lucide-react";

import { DangerZone } from "./danger-zone";
import { ProfileSettings } from "./profile-settings";
import { SecuritySettings } from "./security-settings";
import { DemoNote, SettingsCard, SettingsHeading, SettingsRow } from "./settings-card";
import { shortcutGroups } from "./settings-data";
import { SharingSettings } from "./sharing-settings";
import { stackClass } from "./styles";

// The settings sections that aren't pages of their own.
export function Preferences({ section }: { section: string }) {
  if (section === "account" || section === "general") return <ProfileSettings />;
  if (section === "keyboard") return <KeyboardSettings />;
  if (section === "notifications") return <NotificationSettings />;
  if (section === "security") return <SecuritySettings />;
  if (section === "sharing" || section === "permissions")
    return <SharingSettings section={section} />;
  if (section === "danger") return <DangerZone />;
  return (
    <SettingsHeading
      title="Settings section not found"
      description="Select a section from the settings menu."
    />
  );
}

function KeyboardSettings() {
  return (
    <>
      <SettingsHeading
        title="A little less clicking"
        description="Move through your workspace with keyboard shortcuts. On Windows and Linux, use Ctrl in place of ⌘."
      />
      <div className={stackClass}>
        {shortcutGroups.map((group) => (
          <SettingsCard key={group.title} title={group.title} description={group.description}>
            <dl>
              {group.items.map(([action, keys]) => (
                <div
                  className="flex items-center justify-between gap-4 px-5 py-2.75 text-[13px] max-md:px-4 max-md:py-2.5 [&+&]:border-t"
                  key={action}
                >
                  <dt>{action}</dt>
                  <dd className="flex shrink-0 gap-1">
                    {keys.map((k) => (
                      <kbd
                        key={k}
                        className="inline-grid h-6 min-w-6 place-items-center rounded-[6px] border border-b-2 bg-[color-mix(in_srgb,var(--muted)_60%,var(--card))] px-1.75 font-[inherit] text-[11.5px] font-medium whitespace-nowrap"
                      >
                        {k}
                      </kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </SettingsCard>
        ))}
      </div>
    </>
  );
}

function NotificationSettings() {
  return (
    <>
      <SettingsHeading
        title="Stay in the loop"
        description="Where updates from your workspace show up."
      />
      <div className={stackClass}>
        <SettingsCard title="Notifications" description="What this workspace tells you about.">
          <SettingsRow
            icon={Bell}
            title="In-app notifications"
            description="Invitations to join an organization appear in the bell in the header."
          />
        </SettingsCard>
      </div>
      {/* The switches that stood here (file sharing, mentions, uploads,
          storage alerts, weekly digest) each said "Preference saved" and saved
          nothing: the value lived in the client store for the rest of the
          session and was gone on the next load. Nothing in the product read it
          either. They come back with somewhere to save to. */}
      <DemoNote className="mt-4">
        Choosing which notifications you get isn&apos;t available yet.
      </DemoNote>
    </>
  );
}
