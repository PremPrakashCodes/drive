"use client";

import { Bell, CircleCheck, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatShortDate } from "@/lib/date";
import { PersonAvatar } from "./common";
import { useWorkspace } from "./store";

// Item padding/gap overrides need `!` to beat the unlayered global menu-item rule; text colors
// need it to beat the item's `focus:**:text-accent-foreground` (the old unlayered CSS won there).
const itemClass = "items-start gap-2.5! px-2! py-[9px]!";
const bodyClass =
  "flex min-w-0 flex-1 flex-col gap-[3px] text-[12px] leading-[1.4] text-muted-foreground!";
const smallClass = "text-[11px] text-muted-foreground!";

export function NotificationsMenu() {
  const { data } = useWorkspace();
  const router = useRouter();
  // Dismissed invitation ids, kept on this device.
  const [dismissed, setDismissed] = useState<string[]>([]);
  const invitations = data.invitations.filter((i) => !dismissed.includes(i.id));
  const unread = invitations.length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          />
        }
      >
        <span className="relative">
          <Bell />
          {unread > 0 && (
            <i className="absolute -top-0.5 -right-px size-[7px] rounded-full border-[1.5px] border-background bg-primary" />
          )}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[340px] max-w-[calc(100vw-32px)] p-1.5!" align="end">
        <div className="flex items-center justify-between gap-3 px-2 pt-1.5 pb-2">
          <strong className="text-[13px] font-semibold">Notifications</strong>
          {unread > 0 && (
            <button
              className="rounded-[5px] px-1 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => setDismissed((d) => [...d, ...invitations.map((i) => i.id)])}
            >
              Mark all as read
            </button>
          )}
        </div>
        <DropdownMenuGroup>
          {invitations.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className={itemClass}
              onClick={() => router.push(`/invite/${n.id}`)}
            >
              <PersonAvatar
                name={n.organization}
                className="grid size-[30px]! place-items-center rounded-full bg-muted! text-[10px] text-muted-foreground!"
              />
              <span className={bodyClass}>
                <span>
                  You&apos;re invited to join{" "}
                  <strong className="font-semibold text-foreground!">{n.organization}</strong>
                </span>
                <small className={smallClass}>Expires {formatShortDate(n.expiresAt)}</small>
              </span>
              <span
                className="mt-[5px] size-[7px] shrink-0 rounded-full bg-primary"
                aria-label="Unread"
              />
            </DropdownMenuItem>
          ))}
          {!invitations.length && (
            <DropdownMenuItem className={itemClass} disabled>
              <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-muted text-[10px] text-muted-foreground">
                <CircleCheck />
              </span>
              <span className={bodyClass}>
                <span>You&apos;re all caught up</span>
                <small className={smallClass}>New invitations appear here</small>
              </span>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push("/settings?section=notifications")}>
            <Settings2 />
            Notification settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
