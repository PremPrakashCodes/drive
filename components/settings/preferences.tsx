"use client";

import { AtSign, CalendarDays, HardDrive, Share2, Upload } from "lucide-react";

import { DangerZone } from "./danger-zone";
import { PreferenceRow } from "./preference-row";
import { ProfileSettings } from "./profile-settings";
import { SecuritySettings } from "./security-settings";
import { DemoNote, SettingsCard, SettingsHeading } from "./settings-card";
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
        description="Choose the updates that matter to you."
      />
      <div className={stackClass}>
        <SettingsCard title="Collaboration" description="Updates from the people you work with.">
          <PreferenceRow
            id="notify-shares"
            icon={Share2}
            title="File sharing"
            description="When someone shares a file or folder with you."
          />
          <PreferenceRow
            id="notify-mentions"
            icon={AtSign}
            title="Mentions and collaboration"
            description="When teammates need your attention."
          />
        </SettingsCard>
        <SettingsCard title="Activity" description="Uploads, storage, and your weekly recap.">
          <PreferenceRow
            id="notify-uploads"
            icon={Upload}
            title="Upload activity"
            description="When your uploads finish or need a retry."
          />
          <PreferenceRow
            id="notify-storage"
            icon={HardDrive}
            title="Storage alerts"
            description="When a storage provider has a connection or sync issue."
          />
          <PreferenceRow
            id="notify-digest"
            icon={CalendarDays}
            title="Weekly activity digest"
            description="A quiet recap of what happened this week."
            defaultOn={false}
          />
        </SettingsCard>
      </div>
      <DemoNote className="mt-4">Notification preferences are saved locally in this demo.</DemoNote>
    </>
  );
}
