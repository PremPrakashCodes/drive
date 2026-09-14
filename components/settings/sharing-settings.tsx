"use client";

import { ChevronRight, FolderTree, Globe, Link2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Choice } from "@/components/workspace/common";
import { PreferenceRow, usePreference } from "./preference-row";
import { DemoNote, SettingsCard, SettingsHeading, SettingsRow } from "./settings-card";
import { inheritance } from "./settings-data";
import { stackClass } from "./styles";

// Sharing (personal) and Permissions (organization) defaults.
export function SharingSettings({ section }: { section: "sharing" | "permissions" }) {
  const { pref, set } = usePreference();
  return (
    <>
      <SettingsHeading
        title={section === "sharing" ? "Better, together" : "The right level of access"}
        description="Set thoughtful defaults for your workspace."
      />
      <div className={stackClass}>
        <SettingsCard title="Defaults" description="Applied whenever files and folders are shared.">
          <SettingsRow
            icon={UserPlus}
            title="Default sharing permission"
            description="Access level for new collaborators."
          >
            <Choice
              label="Default permission"
              className="w-32 shrink-0"
              value={String(pref("permission") || "Viewer")}
              onChange={(v) => {
                set("permission", v);
                toast.success("Preference saved");
              }}
              options={["Viewer", "Editor", "Manager"]}
            />
          </SettingsRow>
          <PreferenceRow
            id="public-sharing"
            icon={Link2}
            title="Allow public links"
            description="Let members create links accessible outside the workspace."
            defaultOn={false}
          />
          <PreferenceRow
            id="external-sharing"
            icon={Globe}
            title="External collaborators"
            description="Allow sharing with people outside your organization."
            defaultOn={false}
          />
          <PreferenceRow
            id="inherit"
            icon={FolderTree}
            title="Inherit folder permissions"
            description="Files inherit access from their parent folder."
          />
        </SettingsCard>
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
