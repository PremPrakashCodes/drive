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
import { useWorkspaceRoute } from "./route";
import { useWorkspace } from "./store";

export function NotificationsMenu() {
  const { data } = useWorkspace();
  const { prefix } = useWorkspaceRoute();
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
        <span className="notification-icon">
          <Bell />
          {unread > 0 && <i />}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="notifications-menu" align="end">
        <div className="notifications-header">
          <strong>Notifications</strong>
          {unread > 0 && (
            <button onClick={() => setDismissed((d) => [...d, ...invitations.map((i) => i.id)])}>
              Mark all as read
            </button>
          )}
        </div>
        <DropdownMenuGroup>
          {invitations.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="notification-item"
              onClick={() => router.push(`/invite/${n.id}`)}
            >
              <PersonAvatar name={n.organization} className="notification-visual" />
              <span className="notification-body">
                <span>
                  You&apos;re invited to join <strong>{n.organization}</strong>
                </span>
                <small>Expires {formatShortDate(n.expiresAt)}</small>
              </span>
              <span className="notification-dot" aria-label="Unread" />
            </DropdownMenuItem>
          ))}
          {!invitations.length && (
            <DropdownMenuItem className="notification-item" disabled>
              <span className="notification-visual">
                <CircleCheck />
              </span>
              <span className="notification-body">
                <span>You&apos;re all caught up</span>
                <small>New invitations appear here</small>
              </span>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push(`${prefix}/settings?section=notifications`)}>
            <Settings2 />
            Notification settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
