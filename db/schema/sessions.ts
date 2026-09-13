import { index, snakeCase, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { organizations } from "@/db/schema/organizations";
import { teams } from "@/db/schema/teams";
import { users } from "@/db/schema/users";

// Better Auth `session` model.
export const sessions = snakeCase.table(
  "sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    // Better Auth organization plugin: currently active organization/team.
    activeOrganizationId: uuid().references(() => organizations.id, {
      onDelete: "set null",
    }),
    activeTeamId: uuid().references(() => teams.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("sessions_user_id_idx").on(t.userId),
    index("sessions_active_organization_id_idx").on(t.activeOrganizationId),
    index("sessions_active_team_id_idx").on(t.activeTeamId),
  ]
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
