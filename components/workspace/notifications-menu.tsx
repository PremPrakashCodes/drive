"use client";
import { useRouter } from "next/navigation";
import { Bell, CircleCheck, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PersonAvatar } from "./common";
import { useWorkspace } from "./store";
import { useWorkspaceRoute } from "./route";
const notifications = [
  {
    id: "roadmap-shared",
    actor: "Priya Shah",
    message: "shared Product roadmap.fig with you",
    meta: "Yesterday · Design team",
    path: "/shared",
  },
  {
    id: "files-synced",
    message: "Your files are up to date",
    meta: "Synced with your storage provider",
    path: "/storage",
  },
];
export function NotificationsMenu() {
  const { data, update } = useWorkspace();
  const { workspace, base, prefix } = useWorkspaceRoute();
  const router = useRouter();
  const key = `${workspace}:notifications-read`;
  const read: string[] = JSON.parse(String(data.preferences[key] || "[]"));
  const unread = notifications.filter((n) => !read.includes(n.id)).length;
  const markRead = (ids: string[]) =>
    update((d) => {
      const previous: string[] = JSON.parse(String(d.preferences[key] || "[]"));
      return {
        ...d,
        preferences: {
          ...d.preferences,
          [key]: JSON.stringify([...new Set([...previous, ...ids])]),
        },
      };
    });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              unread ? `Notifications, ${unread} unread` : "Notifications"
            }
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
            <button onClick={() => markRead(notifications.map((n) => n.id))}>
              Mark all as read
            </button>
          )}
        </div>
        <DropdownMenuGroup>
          {notifications.map((n) => {
            const isUnread = !read.includes(n.id);
            return (
              <DropdownMenuItem
                key={n.id}
                className="notification-item"
                data-unread={isUnread || undefined}
                onClick={() => {
                  markRead([n.id]);
                  router.push(`${base}${n.path}`);
                }}
              >
                {n.actor ? (
                  <PersonAvatar name={n.actor} className="notification-visual" />
                ) : (
                  <span className="notification-visual">
                    <CircleCheck />
                  </span>
                )}
                <span className="notification-body">
                  <span>
                    {n.actor && <strong>{n.actor.split(" ")[0]} </strong>}
                    {n.message}
                  </span>
                  <small>{n.meta}</small>
                </span>
                {isUnread && (
                  <span className="notification-dot" aria-label="Unread" />
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() =>
              router.push(`${prefix}/settings?section=notifications`)
            }
          >
            <Settings2 />
            Notification settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
