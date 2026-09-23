import { bigint, integer, snakeCase, text, uuid } from "drizzle-orm/pg-core";

// Better Auth `rateLimit` model, added by `rateLimit.storage: "database"` in
// lib/auth.ts. One row per client-and-path bucket: without it the counters sit
// in the memory of a single serverless instance and reset on every cold start.
// `key` is unique because the limiter's atomic increment matches on it, and
// `lastRequest` is epoch milliseconds (a number, not a timestamp column).
export const rateLimits = snakeCase.table("rate_limits", {
  id: uuid().primaryKey().defaultRandom(),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: bigint({ mode: "number" }).notNull(),
});

export type RateLimit = typeof rateLimits.$inferSelect;
export type NewRateLimit = typeof rateLimits.$inferInsert;
