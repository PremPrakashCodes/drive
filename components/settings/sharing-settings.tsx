"use client";

import { ChevronRight } from "lucide-react";

import { DemoNote, SettingsCard, SettingsHeading } from "./settings-card";
import { inheritance } from "./settings-data";
import { stackClass } from "./styles";

// Sharing (personal) and Permissions (organization) defaults.
export function SharingSettings({ section }: { section: "sharing" | "permissions" }) {
  return (
    <>
      <SettingsHeading
        title={section === "sharing" ? "Better, together" : "The right level of access"}
        description="How access works inside this workspace."
      />
      <div className={stackClass}>
        {/* A "Defaults" card stood here: a default-permission select and
            switches for public links, external collaborators and permission
            inheritance. Each said "Preference saved", kept the value in the
            client store until the next page load, and was read by nothing —
            sharing behaves the same whichever way they were set. */}
        <SettingsCard
          title="Permission inheritance"
          description="Inherited permissions are shown in each file’s sharing dialog."
        >
          <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 px-5 py-4.5">
            {inheritance.map(([label, Icon], i) => (
              <li key={label} className="flex items-center gap-1.5">
                {i > 0 && (
                  <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
                )}
                <span className="inline-flex h-8 items-center gap-1.75 rounded-full border bg-[color-mix(in_srgb,var(--muted)_50%,var(--card))] px-3 text-[12.5px] font-medium">
                  <Icon aria-hidden="true" className="size-3.5 text-muted-foreground" />
                  {label}
                </span>
              </li>
            ))}
          </ol>
        </SettingsCard>
      </div>
      <DemoNote className="mt-4">
        Sharing inside a drive is simple: everything marked shared is visible to all members;
        private items stay visible only to you.
      </DemoNote>
    </>
  );
}
