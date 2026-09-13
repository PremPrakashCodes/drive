import {
  index,
  integer,
  snakeCase,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "@/db/schema/organizations";

// Better Auth organization plugin `team` model (teams feature). `memberCount`
// is a durable count maintained by the plugin to enforce team capacity
// (maximumMembers) without counting rows on every write.
export const teams = snakeCase.table(
  "teams",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text().notNull(),
    memberCount: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("teams_organization_id_idx").on(t.organizationId)],
);

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
