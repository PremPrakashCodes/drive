import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { bigint, index, primaryKey, snakeCase, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { driveItemKind, driveItemVisibility } from "@/db/schema/enums";
import { organizations } from "@/db/schema/organizations";
import { users } from "@/db/schema/users";

// Files and folders in a workspace (personal or organization). Shared items
// are visible to every member; private items only to `createdById`. Anything
// inside a private folder is private to the same creator.
export const driveItems = snakeCase.table(
  "drive_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    parentId: uuid().references((): AnyPgColumn => driveItems.id, {
      onDelete: "cascade",
    }),
    kind: driveItemKind().notNull(),
    name: text().notNull(),
    size: bigint({ mode: "number" }).notNull().default(0),
    mimeType: text(),
    // Object key in the workspace's storage bucket; null for folders.
    storageKey: text(),
    visibility: driveItemVisibility().notNull().default("shared"),
    color: text(),
    createdById: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    trashedAt: timestamp({ withTimezone: true }),
    // Set while the item is in its creator's Locked folder: private, and left
    // out of every listing until they unlock the folder with their PIN.
    lockedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("drive_items_organization_parent_idx").on(t.organizationId, t.parentId),
    index("drive_items_parent_id_idx").on(t.parentId),
    index("drive_items_created_by_id_idx").on(t.createdById),
  ]
);

// Stars are personal: everyone in a workspace sees the same shared files.
export const driveStars = snakeCase.table(
  "drive_stars",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: uuid()
      .notNull()
      .references(() => driveItems.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.itemId] }),
    index("drive_stars_item_id_idx").on(t.itemId),
  ]
);

export type DriveItem = typeof driveItems.$inferSelect;
export type NewDriveItem = typeof driveItems.$inferInsert;
export type DriveStar = typeof driveStars.$inferSelect;
