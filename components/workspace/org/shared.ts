import { CalendarPlus, Shapes, Users } from "lucide-react";

import { useWorkspace } from "@/components/workspace/store";

// Server data for the open organization: loaded once per org route by the
// workspace store, and `load` refreshes it after each mutation.
export function useOrgData() {
  const { organization } = useWorkspace();
  return { overview: organization.overview, load: organization.reload };
}

export const teamIcon = [CalendarPlus, Shapes, Users];
// Team colors come from data; blue has no emblem style of its own and keeps the default look.
export const emblemColor: Record<string, string> = {
  green: "bg-surface-green text-primary",
  purple: "bg-surface-purple text-folder-purple",
  amber: "bg-surface-amber text-folder-amber",
  blue: "bg-surface-green text-primary",
};
// Second and third stacked avatars get their own tint.
export const introAvatarTint = [
  "",
  "[&_[data-slot=avatar-fallback]]:bg-surface-purple! [&_[data-slot=avatar-fallback]]:text-folder-purple!",
  "[&_[data-slot=avatar-fallback]]:bg-surface-blue! [&_[data-slot=avatar-fallback]]:text-folder-blue!",
];
export const metricCard = "shadow-none ring-0";
export const sectionButton =
  "flex items-center gap-[7px] text-[10px] text-muted-foreground hover:text-muted-foreground md:text-[11px]";

// Members and Teams also render inside settings, where the page title is smaller.
export const pageHeadingClass = (inSettings?: boolean) =>
  inSettings
    ? "mb-5 flex items-center justify-between gap-6 max-md:flex-wrap max-md:items-start max-md:gap-3"
    : "mb-[29px] flex items-center justify-between gap-6 max-md:mb-[23px] max-md:items-start max-md:gap-3";
export const pageTitleClass = (inSettings?: boolean) =>
  inSettings
    ? "text-[19px] leading-[1.3] font-medium tracking-[-0.4px]"
    : "text-[29px] leading-[1.3] font-[550] tracking-[-1.2px] max-md:text-[27px]";
