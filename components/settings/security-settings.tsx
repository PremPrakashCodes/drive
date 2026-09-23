"use client";

import { formatDistanceToNow } from "date-fns";
import { KeyRound, Monitor, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { listAuthSessions, revokeAuthSession } from "@/app/(protected)/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceRoute } from "@/components/workspace/route";
import { useActionGuard } from "@/hooks/use-action-guard";
import { formatMediumDate } from "@/lib/date";
import { LockedFolderSettings } from "./locked-folder-settings";
import { SettingsCard, SettingsHeading, SettingsRow } from "./settings-card";
import { rowClass, stackClass, statusDotClass } from "./styles";

type SessionRow = {
  id: string;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
  isCurrent: boolean;
};

export function SecuritySettings() {
  const { org } = useWorkspaceRoute();
  // null = still loading; [] would read as "no sessions".
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const revoking = useActionGuard();

  const load = useCallback(
    () =>
      listAuthSessions().then((result) => {
        if (result.ok) {
          setSessions(result.data);
          setLoadError(null);
        } else {
          setLoadError(result.error);
        }
      }),
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(id: string) {
    setBusyId(id);
    const result = await revoking.run(() => revokeAuthSession({ id }));
    setBusyId(null);
    if (!result) return; // a second click never started a request
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSessions((prev) => (prev ? prev.filter((session) => session.id !== id) : prev));
    toast.success("Device signed out");
  }

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
        </SettingsCard>
        <SettingsCard title="Sessions" description="Devices currently signed in to your account.">
          {loadError ? (
            <SettingsRow icon={Monitor} title="Couldn’t load sessions" description={loadError}>
              <Button variant="outline" onClick={() => void load()}>
                Try again
              </Button>
            </SettingsRow>
          ) : !sessions ? (
            <div className={rowClass}>
              <Skeleton className="size-8 shrink-0 rounded-[9px]" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
          ) : (
            sessions.map((session) => (
              <SettingsRow
                key={session.id}
                icon={Monitor}
                title={session.isCurrent ? "This device" : describeDevice(session.userAgent)}
                description={
                  session.isCurrent
                    ? `Current browser session · Signed in ${formatMediumDate(session.createdAt)}`
                    : `Signed in ${formatMediumDate(session.createdAt)} · Last active ${formatDistanceToNow(session.updatedAt, { addSuffix: true })}`
                }
              >
                {session.isCurrent ? (
                  <Badge variant="secondary" className="gap-1.5">
                    <span className={statusDotClass} aria-hidden="true" />
                    Active now
                  </Badge>
                ) : (
                  <Button
                    variant="outline"
                    disabled={revoking.pending}
                    onClick={() => void revoke(session.id)}
                  >
                    {busyId === session.id ? "Signing out…" : "Sign out"}
                  </Button>
                )}
              </SettingsRow>
            ))
          )}
        </SettingsCard>
      </div>
    </>
  );
}

// "Chrome on macOS" beats "Mac browser": the user agent already says which
// browser and operating system the session came from. Order matters — Edge
// and Opera also contain "Chrome", Chrome also contains "Safari".
function describeDevice(userAgent: string | null) {
  if (!userAgent) return "Unknown device";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Browser";
  const os = /iPhone|iPad/.test(userAgent)
    ? "iOS"
    : /Android/.test(userAgent)
      ? "Android"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Mac OS X/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "an unknown system";
  return `${browser} on ${os}`;
}
