import { snakeCase, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { workspaceKind } from "@/db/schema/enums";

// Better Auth organization plugin `organization` model (usePlural: true).
export const organizations = snakeCase.table("organizations", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  logo: text(),
  metadata: text(), // JSON serialized by better-auth
  // "personal" workspaces are created by the app (one per user, slug
  // `personal-<userId>`); "organization" ones by users. See lib/auth.ts.
  kind: workspaceKind().notNull().default("organization"),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
