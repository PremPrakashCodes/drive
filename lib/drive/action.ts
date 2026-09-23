import "server-only";

import type { ActionResult } from "@/types";
import { APIError } from "better-auth/api";
import type { BatchItem } from "drizzle-orm/batch";
import { z } from "zod";

import { db } from "@/db";
import { DriveError } from "@/lib/drive/workspace";

// How many levels below an item a walk over the folder tree will read. Far
// past any structure a person builds by hand — a folder upload caps a path at
// 64 names — so reaching it means the rows describe a loop, or a tree no
// mutation should be applied to only part of.
export const MAX_TREE_DEPTH = 128;

// Keeps `IN (...)` lists well under Postgres' bind-parameter limit. A whole
// dropped directory lands in one mutation, so a tree-wide write can bind more
// parameters than a single statement may carry.
const CHUNK = 500;
export const chunks = <T>(list: T[]) =>
  Array.from({ length: Math.ceil(list.length / CHUNK) }, (_, i) =>
    list.slice(i * CHUNK, (i + 1) * CHUNK)
  );

// Applies every statement or none of them. `db.batch` types its argument as a
// non-empty tuple, which a list built from chunking a subtree isn't; the
// statements themselves are handed over untouched.
export const atomically = (statements: BatchItem<"pg">[]) =>
  db.batch(statements as [BatchItem<"pg">, ...BatchItem<"pg">[]]);

export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof DriveError) return { ok: false, error: error.message, code: error.code };
    if (error instanceof APIError && error.statusCode < 500)
      return { ok: false, error: error.body?.message ?? error.message };
    console.error("[drive]", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new DriveError(result.error.issues[0]?.message ?? "Invalid input.");
  return result.data;
}

export const Id = z.uuid("Invalid item.");
