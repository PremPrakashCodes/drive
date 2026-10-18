import type { WorkspaceAlignmentInput, WorkspaceDestination } from "@/types";

import { findOrganization } from "./listing";

// A personal route may show a family drive, but an organization always has
// its own route. The remembered personal drive matters when using Back/Forward.
export function getWorkspaceAlignment({
  org,
  organizations,
  listing,
  lastPersonalId,
}: WorkspaceAlignmentInput) {
  if (org) {
    const targetId = findOrganization(organizations, org)?.id;
    return { targetId, aligned: Boolean(listing && targetId === listing.workspace.id) };
  }
  if (listing?.workspace.kind === "personal")
    return { targetId: listing.workspace.id, aligned: true };
  return {
    targetId: lastPersonalId ?? listing?.spaces.find((space) => space.own)?.id,
    aligned: false,
  };
}

// Cookie refresh and App Router navigation finish independently. Neither is
// sufficient on its own to release the manual-switch guard.
export function workspaceDestinationReady(
  destination: WorkspaceDestination,
  pathname: string,
  workspaceId: string | undefined
) {
  return pathname === destination.pathname && workspaceId === destination.id;
}
