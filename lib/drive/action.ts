import "server-only";

import type { ActionResult } from "@/types";
import { APIError } from "better-auth/api";
import { z } from "zod";

import { DriveError } from "@/lib/drive/workspace";

export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof DriveError) return { ok: false, error: error.message };
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
