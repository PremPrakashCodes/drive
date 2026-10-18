import type { ActionResult, DriveListing } from "@/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./drive-listing", () => ({ getDrive: vi.fn() }));
vi.mock("./org", () => ({ getOrganizations: vi.fn(), getMyInvitations: vi.fn() }));

import { getDrive } from "./drive-listing";
import { getMyInvitations, getOrganizations } from "./org";
import { getWorkspaceSnapshot } from "./workspace-snapshot";

describe("workspace snapshot", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getOrganizations).mockResolvedValue({ ok: true, data: [] });
    vi.mocked(getMyInvitations).mockResolvedValue({ ok: true, data: [] });
  });

  it("starts the independent reads without waiting for the drive to settle", async () => {
    const drive = Promise.withResolvers<ActionResult<DriveListing>>();
    vi.mocked(getDrive).mockReturnValue(drive.promise);

    const pending = getWorkspaceSnapshot();
    expect(getDrive).toHaveBeenCalledOnce();
    expect(getOrganizations).toHaveBeenCalledOnce();
    expect(getMyInvitations).toHaveBeenCalledOnce();

    drive.resolve({ ok: false, error: "Storage unavailable" });
    await expect(pending).resolves.toEqual({
      ok: true,
      data: {
        drive: { ok: false, error: "Storage unavailable" },
        organizations: { ok: true, data: [] },
        invitations: { ok: true, data: [] },
      },
    });
  });

  it("preserves session-expiry codes and independent errors for the client", async () => {
    vi.mocked(getDrive).mockResolvedValue({
      ok: false,
      error: "Sign in again",
      code: "session-expired",
    });
    vi.mocked(getMyInvitations).mockResolvedValue({ ok: false, error: "Invitations unavailable" });

    const result = await getWorkspaceSnapshot();
    expect(result).toEqual({
      ok: true,
      data: {
        drive: { ok: false, error: "Sign in again", code: "session-expired" },
        organizations: { ok: true, data: [] },
        invitations: { ok: false, error: "Invitations unavailable" },
      },
    });
  });
});
