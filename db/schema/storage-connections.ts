import { sql } from "drizzle-orm";
import {
  boolean,
  bytea,
  index,
  jsonb,
  snakeCase,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { organizations } from "@/db/schema/organizations";
import { storageProviders } from "@/db/schema/storage-providers";
import { users } from "@/db/schema/users";

// Non-secret per-connection settings (bucket, region, endpoint…).
export type StorageConnectionConfig = {
  bucket: string;
  region?: string;
  endpoint?: string;
};

// A user's configured connection to a storage provider. `config` holds
// non-secret settings; `credentialsEncrypted` holds the encrypted credential
// blob (access key id + secret, IV/tag included) — encrypt before insert.
export const storageConnections = snakeCase.table(
  "storage_connections",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid().references(() => organizations.id, {
      onDelete: "set null",
    }),
    providerId: uuid()
      .notNull()
      .references(() => storageProviders.id),
    config: jsonb().$type<StorageConnectionConfig>().notNull(),
    credentialsEncrypted: bytea().notNull(),
    isDefault: boolean().notNull().default(false),
    lastVerifiedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("storage_connections_user_id_idx").on(t.userId),
    index("storage_connections_organization_id_idx").on(t.organizationId),
    // At most one default connection per user.
    uniqueIndex("storage_connections_one_default_per_user_idx")
      .on(t.userId)
      .where(sql`is_default`),
  ]
);

export type StorageConnection = typeof storageConnections.$inferSelect;
export type NewStorageConnection = typeof storageConnections.$inferInsert;
