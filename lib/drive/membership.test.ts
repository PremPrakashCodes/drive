import type { Workspace } from "@/types";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { auth } from "@/lib/auth";
import { leaveWorkspace } from "@/lib/drive/members";
import { removeWorkspaceMember } from "@/lib/drive/membership";
import { workspaceBucket } from "@/lib/drive/s3";
import { DriveError, requireWorkspace } from "@/lib/drive/workspace";

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));
vi.mock("@/lib/auth", () => ({
  auth: { api: { removeMember: vi.fn(), leaveOrganization: vi.fn() } },
}));
vi.mock("@/lib/drive/s3", () => ({ workspaceBucket: vi.fn() }));
vi.mock("@/lib/drive/workspace", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/drive/workspace")>();
  return { ...actual, requireWorkspace: vi.fn(actual.requireWorkspace) };
});

// Someone's private files leave with them. Purging is the part that can fail —
// no storage connected, the bucket unreachable — so it has to happen while
// they are still a member; otherwise their files stay behind with no one who
// can reach them.
describe("a departing member's private files", () => {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const memberId = randomUUID();
  // Each `db.select(...).from(...).where(...)` in order: the member row, then
  // the storage keys of the private files to remove.
  let reads: unknown[][];

  beforeEach(() => {
    reads = [[{ id: memberId, userId, role: "member" }], [{ storageKey: "key" }]];
    vi.spyOn(db, "select").mockImplementation((() => ({
      from: () => ({ where: async () => reads.shift() ?? [] }),
    })) as never);
    vi.spyOn(db, "batch").mockResolvedValue([] as never);
    vi.mocked(workspaceBucket).mockRejectedValue(new DriveError("This drive has no storage yet."));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the membership when removing a member can't purge them", async () => {
    await expect(removeWorkspaceMember(organizationId, memberId, "Not here.")).rejects.toThrow(
      "no storage"
    );
    expect(auth.api.removeMember).not.toHaveBeenCalled();
  });

  it("keeps you in the drive when leaving can't purge you", async () => {
    reads = [[{ storageKey: "key" }]];
    const ws: Workspace = {
      id: organizationId,
      name: "Family drive",
      role: "member",
      userId,
      own: false,
      kind: "personal",
    };
    vi.mocked(requireWorkspace).mockResolvedValue(ws);

    const result = await leaveWorkspace();
    expect(result).toEqual({ ok: false, error: "This drive has no storage yet." });
    expect(auth.api.leaveOrganization).not.toHaveBeenCalled();
  });
});
