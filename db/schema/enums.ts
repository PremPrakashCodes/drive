import { pgEnum } from "drizzle-orm/pg-core";

// "personal": one per user, created by the app (see lib/drive/workspace.ts).
// "organization": created by users through Better Auth.
export const workspaceKind = pgEnum("workspace_kind", ["personal", "organization"]);

// Mirrors FileKind in lib/workspace/data.ts.
export const driveItemKind = pgEnum("drive_item_kind", [
  "folder",
  "pdf",
  "image",
  "video",
  "code",
  "document",
  "spreadsheet",
  "archive",
  "audio",
]);

// "shared": every workspace member can see it. "private": only its creator.
export const driveItemVisibility = pgEnum("drive_item_visibility", ["shared", "private"]);

export type WorkspaceKind = (typeof workspaceKind.enumValues)[number];
export type DriveItemKind = (typeof driveItemKind.enumValues)[number];
export type DriveItemVisibility = (typeof driveItemVisibility.enumValues)[number];
