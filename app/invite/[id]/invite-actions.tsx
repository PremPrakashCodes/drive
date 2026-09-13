"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
      router.push("/drive");
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
