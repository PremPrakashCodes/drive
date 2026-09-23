import type { Workspace } from "@/types";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import {
  INVITE_MAX_PER_WINDOW,
  inviteQuotaRefusal,
  invitesRemaining,
} from "@/lib/drive/invite-limit";
import { inviteMember } from "@/lib/drive/members";
import { requireWorkspace } from "@/lib/drive/workspace";

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));
vi.mock("@/lib/auth", () => ({ auth: { api: { createInvitation: vi.fn() } } }));
vi.mock("@/lib/drive/workspace", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/drive/workspace")>();
  return { ...actual, requireWorkspace: vi.fn() };
});

describe("invitesRemaining", () => {
  it("counts down from the window's allowance", () => {
    expect(invitesRemaining(0)).toBe(INVITE_MAX_PER_WINDOW);
    expect(invitesRemaining(1)).toBe(INVITE_MAX_PER_WINDOW - 1);
  });

  it("never goes below zero, however far over the sender is", () => {
    expect(invitesRemaining(INVITE_MAX_PER_WINDOW)).toBe(0);
    expect(invitesRemaining(INVITE_MAX_PER_WINDOW + 500)).toBe(0);
  });
});

describe("inviteQuotaRefusal", () => {
  it("lets a batch through while it fits", () => {
    expect(inviteQuotaRefusal(0, 1)).toBeNull();
    expect(inviteQuotaRefusal(0, INVITE_MAX_PER_WINDOW)).toBeNull();
    expect(inviteQuotaRefusal(INVITE_MAX_PER_WINDOW - 1, 1)).toBeNull();
  });

  it("refuses the batch that would cross the line, not just the one after", () => {
    expect(inviteQuotaRefusal(INVITE_MAX_PER_WINDOW - 1, 2)).not.toBeNull();
    expect(inviteQuotaRefusal(0, INVITE_MAX_PER_WINDOW + 1)).not.toBeNull();
  });

  it("says how much room is left, so the sender can send a smaller batch", () => {
    expect(inviteQuotaRefusal(INVITE_MAX_PER_WINDOW - 3, 5)).toContain("3 more invitations");
    expect(inviteQuotaRefusal(INVITE_MAX_PER_WINDOW - 1, 4)).toContain("1 more invitation this");
  });

  it("tells a sender with nothing left to come back later", () => {
    const refusal = inviteQuotaRefusal(INVITE_MAX_PER_WINDOW, 1);
    expect(refusal).toContain("Try again later");
    expect(refusal).not.toContain("0 more");
  });

  it("stays refused when the recent count has run past the allowance", () => {
    expect(inviteQuotaRefusal(INVITE_MAX_PER_WINDOW + 10, 1)).toContain("Try again later");
  });
});

// Inviting someone sends mail to an address the sender chose, and every person
// owns the drive that was created for them, so the ability is never out of
// reach. These calls invoke the endpoint directly rather than over HTTP, so
// the framework's own limiter never sees them.
describe("inviting from a personal drive", () => {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const workspace: Workspace = {
    id: organizationId,
    name: "Home",
    role: "owner",
    userId,
    own: true,
    kind: "personal",
  };
  let sentThisHour: number;

  beforeEach(() => {
    vi.clearAllMocks();
    sentThisHour = 0;
    vi.mocked(requireWorkspace).mockResolvedValue(workspace);
    vi.spyOn(db, "select").mockImplementation((() => ({
      from: () => ({ where: async () => [{ sent: sentThisHour }] }),
    })) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends while the sender is inside their hourly allowance", async () => {
    sentThisHour = INVITE_MAX_PER_WINDOW - 1;
    await expect(inviteMember("someone@example.com")).resolves.toEqual({
      ok: true,
      data: undefined,
    });
    expect(auth.api.createInvitation).toHaveBeenCalledTimes(1);
  });

  it("refuses once the allowance is spent, without sending", async () => {
    sentThisHour = INVITE_MAX_PER_WINDOW;
    const result = await inviteMember("someone@example.com");
    expect(result).toMatchObject({ ok: false });
    expect(result.ok === false && result.error).toContain("Try again later");
    expect(auth.api.createInvitation).not.toHaveBeenCalled();
  });
});
