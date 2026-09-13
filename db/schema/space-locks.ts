import {
  index,
  integer,
  primaryKey,
  snakeCase,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "@/db/schema/users";
import { organizations } from "@/db/schema/organizations";

// A person's Locked folder PIN in a space (their drive or a family drive they
// joined). Items they lock there carry `drive_items.locked_at`.
export const spaceLocks = snakeCase.table(
  "space_locks",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // Scrypt hash of the 6-digit PIN (better-auth/crypto). Unlock cookies are
    // signed over it, so changing the PIN ends every existing unlock.
    secretHash: text().notNull(),
    // Wrong tries in a row; past a few, `retryAfter` backs off exponentially.
    failedAttempts: integer().notNull().default(0),
    retryAfter: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.organizationId] }),
    index("space_locks_organization_id_idx").on(t.organizationId),
  ],
);

export type SpaceLock = typeof spaceLocks.$inferSelect;
export type NewSpaceLock = typeof spaceLocks.$inferInsert;
