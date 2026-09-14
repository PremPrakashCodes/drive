"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { orgPath } from "@/components/workspace/route";
import { acceptInvite, declineInvite } from "@/lib/drive/members";

export function InviteActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const respond = (accept: boolean) =>
    startTransition(async () => {
      const result = await (accept ? acceptInvite(id) : declineInvite(id));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // An organization invitation opens that org's drive; family drives open yours.
      const slug = result.ok && result.data ? result.data.slug : null;
      router.push(slug ? orgPath(slug) : "/drive");
      router.refresh();
    });
  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button disabled={pending} onClick={() => respond(true)}>
        {pending ? "Joining…" : "Accept and open drive"}
      </Button>
      <Button variant="ghost" disabled={pending} onClick={() => respond(false)}>
        Decline
      </Button>
    </div>
  );
}
