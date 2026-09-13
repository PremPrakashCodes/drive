import { index, snakeCase, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { organizations } from "@/db/schema/organizations";
import { teams } from "@/db/schema/teams";
import { users } from "@/db/schema/users";

// Better Auth organization plugin `invitation` model.
// status: "pending" | "accepted" | "rejected" | "canceled".
export const invitations = snakeCase.table(
  "invitations",
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull(),
    inviterId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // Teams feature: invitee joins this team upon accepting.
    teamId: uuid().references(() => teams.id, { onDelete: "set null" }),
    role: text(),
    status: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("invitations_inviter_id_idx").on(t.inviterId),
    index("invitations_organization_id_idx").on(t.organizationId),
    index("invitations_team_id_idx").on(t.teamId),
  ]
);

export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
