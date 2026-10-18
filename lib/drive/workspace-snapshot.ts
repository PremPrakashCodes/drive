"use server";

import type { ActionResult, WorkspaceSnapshot } from "@/types";

import { run } from "./action";
import { getDrive } from "./drive-listing";
import { getMyInvitations, getOrganizations } from "./org";

// One browser action request, with independent reads started together on the
// server. Keep the per-source ActionResults so partial failures retain the
// provider's existing data and messages. No cross-request cache: permissions
// and the Locked folder's renewed cookie belong to the current request.
export async function getWorkspaceSnapshot(): Promise<ActionResult<WorkspaceSnapshot>> {
  return run(async () => {
    const [drive, organizations, invitations] = await Promise.all([
      getDrive(),
      getOrganizations(),
      getMyInvitations(),
    ]);
    return { drive, organizations, invitations };
  });
}
