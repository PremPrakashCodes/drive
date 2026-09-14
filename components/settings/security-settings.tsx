"use client";

import { BellRing, KeyRound, Monitor, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkspaceRoute } from "@/components/workspace/route";
import { LockedFolderSettings } from "./locked-folder-settings";
import { PreferenceRow } from "./preference-row";
import { DemoNote, SettingsCard, SettingsHeading, SettingsRow } from "./settings-card";
import { stackClass, statusDotClass } from "./styles";

export function SecuritySettings() {
  const { org } = useWorkspaceRoute();
  return (
    <>
      <SettingsHeading
        title="Keep your space secure"
        description="Manage how you access your workspace."
      />
      <div className={stackClass}>
        {!org && <LockedFolderSettings />}
        <SettingsCard title="Sign-in" description="How you prove it’s really you.">
          <SettingsRow
            icon={KeyRound}
            title="Password"
            description="Update your password using a secure email link."
          >
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/forgot-password" />}
            >
              Reset password
            </Button>
          </SettingsRow>
          <SettingsRow
            icon={ShieldCheck}
            title="Two-factor authentication"
            description="Requires backend setup before enrollment."
          >
            <Badge variant="outline">Not configured</Badge>
          </SettingsRow>
          <PreferenceRow
            id="login-alert"
            icon={BellRing}
            title="Sign-in alerts"
            description="Notify me about new device sign-ins."
          />
        </SettingsCard>
        <SettingsCard title="Sessions" description="Devices currently signed in to your account.">
          <SettingsRow icon={Monitor} title="This device" description="Current browser session">
            <Badge variant="secondary" className="gap-1.5">
              <span className={statusDotClass} aria-hidden="true" />
              Active now
            </Badge>
          </SettingsRow>
        </SettingsCard>
      </div>
      <DemoNote className="mt-4">Security preferences shown here are a UI preview.</DemoNote>
    </>
  );
}
