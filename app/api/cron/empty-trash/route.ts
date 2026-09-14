import type { NextRequest } from "next/server";

import { env } from "@/env";
import { purgeExpiredTrash } from "@/lib/drive/trash";

// Called daily by Vercel Cron (see vercel.json), which sends
// `Authorization: Bearer $CRON_SECRET`. /api routes bypass the auth proxy.
export async function GET(request: NextRequest) {
  if (!env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`)
    return new Response("Unauthorized", { status: 401 });

  const result = await purgeExpiredTrash();
  return Response.json(result, { status: result.failed.length ? 500 : 200 });
}
