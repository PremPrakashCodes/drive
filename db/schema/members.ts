import { index, snakeCase, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organizations } from "@/db/schema/organizations";
import { users } from "@/db/schema/users";

// Better Auth organization plugin `member` model. Role is one of the plugin's
// access roles: "owner" | "admin" | "member" (customizable).
export const members = snakeCase.table(
  "members",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("members_user_id_idx").on(t.userId),
    index("members_organization_id_idx").on(t.organizationId),
    uniqueIndex("members_user_organization_idx").on(t.userId, t.organizationId),
  ]
);

export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;
