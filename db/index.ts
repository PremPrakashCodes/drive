import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { relations } from "@/db/relations";
import { env } from "@/env";

if (!env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add your Neon connection string to .env.local.");
}

export const db = drizzle({ client: neon(env.DATABASE_URL), relations });

export type Database = typeof db;
