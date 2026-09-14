"use client";

import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { useWorkspaceRoute } from "@/components/workspace/route";
import { useWorkspace } from "@/components/workspace/store";
import { SettingsRow } from "./settings-card";

// Preferences saved on this device, keyed per workspace.
export function usePreference() {
  const { data, update } = useWorkspace();
  const { workspace } = useWorkspaceRoute();
  const pref = (key: string) => data.preferences[`${workspace}:${key}`];
  const set = (key: string, value: string | boolean) =>
    update((d) => ({
      ...d,
      preferences: { ...d.preferences, [`${workspace}:${key}`]: value },
    }));
  return { pref, set };
}

// A settings row with a switch bound to one preference.
export function PreferenceRow({
  id,
  icon,
  title,
  description,
  defaultOn = true,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  defaultOn?: boolean;
}) {
  const { pref, set } = usePreference();
  return (
    <SettingsRow icon={icon} title={title} description={description}>
      <Switch
        aria-label={title}
        checked={pref(id) === undefined ? defaultOn : Boolean(pref(id))}
        onCheckedChange={(v) => {
          set(id, v);
          toast.success("Preference saved");
        }}
      />
    </SettingsRow>
  );
}
