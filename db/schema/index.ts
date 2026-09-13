// Barrel for all Drizzle tables. Define each table in its own file in this
// folder (use `snakeCase.table` from drizzle-orm/pg-core for snake_case
// columns), then re-export it here so drizzle-kit picks it up.

export * from "@/db/schema/users";
export * from "@/db/schema/sessions";
export * from "@/db/schema/accounts";
export * from "@/db/schema/verifications";
