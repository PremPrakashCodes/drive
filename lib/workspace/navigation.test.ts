import type { WorkspaceAlignmentInput } from "@/types";
import { describe, expect, it } from "vitest";

import { getWorkspaceAlignment, workspaceDestinationReady } from "./navigation";

const organizations = [{ id: "organization", slug: "team" }];
const listing: NonNullable<WorkspaceAlignmentInput["listing"]> = {
  workspace: { id: "organization", kind: "organization" },
  spaces: [
    { id: "personal", own: true },
    { id: "family", own: false },
  ],
};

describe("workspace route alignment", () => {
  it("never treats organization data as ready for a personal route", () => {
    expect(getWorkspaceAlignment({ org: null, organizations, listing })).toEqual({
      aligned: false,
      targetId: "personal",
    });
  });

  it("returns to the previous family drive when Forward leaves an organization", () => {
    expect(
      getWorkspaceAlignment({ org: null, organizations, listing, lastPersonalId: "family" })
    ).toEqual({ aligned: false, targetId: "family" });
  });

  it("preserves an already active family drive on personal routes", () => {
    expect(
      getWorkspaceAlignment({
        org: null,
        organizations,
        listing: { ...listing, workspace: { id: "family", kind: "personal" } },
      })
    ).toEqual({ aligned: true, targetId: "family" });
  });

  it("aligns an organization deep link without falling back for an unknown slug", () => {
    expect(getWorkspaceAlignment({ org: "team", organizations, listing })).toEqual({
      aligned: true,
      targetId: "organization",
    });
    expect(getWorkspaceAlignment({ org: "unknown", organizations, listing })).toEqual({
      aligned: false,
      targetId: undefined,
    });
  });

  it("waits for the listing even when the organization route is known", () => {
    expect(getWorkspaceAlignment({ org: "team", organizations, listing: null })).toEqual({
      aligned: false,
      targetId: "organization",
    });
  });
});

describe("manual workspace navigation", () => {
  const destination = { id: "personal", pathname: "/drive" };

  it("keeps old-route alignment paused when the new listing arrives first", () => {
    expect(workspaceDestinationReady(destination, "/org/team/drive", "personal")).toBe(false);
    expect(workspaceDestinationReady(destination, "/drive", "personal")).toBe(true);
  });

  it("keeps old data hidden when the new route arrives first", () => {
    expect(workspaceDestinationReady(destination, "/drive", "organization")).toBe(false);
    expect(workspaceDestinationReady(destination, "/drive", undefined)).toBe(false);
    expect(workspaceDestinationReady(destination, "/drive", "personal")).toBe(true);
  });
});
