import type { NextRequest } from "next/server";

import { env } from "@/env";
import { reclaimOrphans } from "@/lib/drive/orphans";

// Called daily by Vercel Cron (see vercel.json), which sends
// `Authorization: Bearer $CRON_SECRET`. /api routes bypass the auth proxy.
export async function GET(request: NextRequest) {
  if (!env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`)
    return new Response("Unauthorized", { status: 401 });

  const result = await reclaimOrphans();
  // Rows whose object is gone are logged, not deleted: the bucket may be
  // temporarily incomplete, and the row is the only record the file existed.
  if (result.unbacked.length)
    console.error(`Drive rows with no storage object: ${result.unbacked.join(", ")}`);
  return Response.json(result, { status: result.failed.length ? 500 : 200 });
}
