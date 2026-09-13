import {
  index,
  snakeCase,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "@/db/schema/users";
import { teams } from "@/db/schema/teams";

// Better Auth organization plugin `teamMember` model. `membershipKey` is an
// internal unique key over the (team, user) pair maintained by the plugin.
export const teamMembers = snakeCase.table(
  "team_members",
  {
    id: uuid().primaryKey().defaultRandom(),
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    membershipKey: text(),
    createdAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("team_members_team_id_idx").on(t.teamId),
    index("team_members_user_id_idx").on(t.userId),
    uniqueIndex("team_members_membership_key_idx").on(t.membershipKey),
  ],
);

export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
