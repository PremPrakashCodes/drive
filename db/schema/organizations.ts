import { snakeCase, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Better Auth organization plugin `organization` model (usePlural: true).
export const organizations = snakeCase.table("organizations", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  logo: text(),
  metadata: text(), // JSON serialized by better-auth
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
