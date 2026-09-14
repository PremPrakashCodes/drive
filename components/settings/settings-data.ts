import type { ShortcutGroup } from "@/types";
import {
  Bell,
  Building2,
  Code2,
  Database,
  FileText,
  Folder,
  Keyboard,
  Lock,
  ScrollText,
  Shapes,
  Shield,
  TriangleAlert,
  User,
  UserPlus,
  Users,
  Webhook,
} from "lucide-react";

// Settings sections for your own workspace and for an organization: [id, label, icon].
export const personalSections = [
  ["account", "Account", User],
  ["security", "Security", Shield],
  ["notifications", "Notifications", Bell],
  ["keyboard", "Keyboard shortcuts", Keyboard],
  ["sharing", "Sharing", Users],
  ["family", "Family & members", UserPlus],
  ["storage", "Storage provider", Database],
  ["developer", "API / Developer", Code2],
  ["danger", "Danger zone", TriangleAlert],
] as const;
export const organizationSections = [
  ["general", "General", Building2],
  ["members", "Members", Users],
  ["teams", "Teams", Shapes],
  ["storage", "Storage provider", Database],
  ["permissions", "Permissions", Lock],
  ["sharing", "Sharing", Users],
  ["security", "Security", Shield],
  ["developer", "API / Developer", Code2],
  ["webhooks", "Webhooks", Webhook],
  ["audit", "Audit log", ScrollText],
  ["danger", "Danger zone", TriangleAlert],
] as const;

export const shortcutGroups: ShortcutGroup[] = [
  {
    title: "Navigation",
    description: "Find, open, and close things quickly.",
    items: [
      ["Search anything", ["⌘", "K"]],
      ["Upload files", ["⌘", "U"]],
      ["Open selected file", ["Enter"]],
      ["Preview selected file", ["Space"]],
      ["Clear selection / close dialog", ["Esc"]],
    ],
  },
  {
    title: "Selection",
    description: "Work with many files at once.",
    items: [
      ["Select all files", ["⌘", "A"]],
      ["Select a range", ["Shift", "Click"]],
      ["Add to selection", ["⌘", "Click"]],
      ["Move selection to trash", ["Delete"]],
    ],
  },
];

// How access flows down, from organization to file.
export const inheritance = [
  ["Organization", Building2],
  ["Team", Shapes],
  ["Folder", Folder],
  ["File", FileText],
] as const;
