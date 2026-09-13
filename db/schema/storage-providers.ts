import { snakeCase, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Catalog of supported object-storage providers (S3, R2, GCS, Azure Blob…).
// Seeded reference data: `name` is the stable slug ("s3", "r2", …);
// `displayName` is the human label shown in the UI.
export const storageProviders = snakeCase.table("storage_providers", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(), // slug, e.g. "s3"
  displayName: text().notNull(), // e.g. "Amazon S3"
  icon: text().notNull(), // icon identifier rendered by the UI
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type StorageProvider = typeof storageProviders.$inferSelect;
export type NewStorageProvider = typeof storageProviders.$inferInsert;
