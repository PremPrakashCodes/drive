import { describe, expect, it, vi } from "vitest";

import { run } from "@/lib/drive/action";
import { DriveError, requireSession } from "@/lib/drive/workspace";
import { isSessionExpired } from "@/lib/workspace/session";

// No request, and nobody signed in: exactly the state a session that ran out
// leaves behind.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: async () => null } } }));

describe("run", () => {
  it("carries a tagged failure's code across the action boundary", async () => {
    const result = await run(async () => {
      throw new DriveError("Your session expired. Sign in again.", "session-expired");
    });
    expect(result).toEqual({
      ok: false,
      error: "Your session expired. Sign in again.",
      code: "session-expired",
    });
  });

  it("leaves an ordinary expected failure untagged", async () => {
    const result = await run(async () => {
      throw new DriveError("Only the drive owner can rename it.");
    });
    expect(result.ok).toBe(false);
    expect(isSessionExpired(result)).toBe(false);
  });

  it("tags the failure the session guard produces, so the client can route on it", async () => {
    const result = await run(requireSession);
    expect(isSessionExpired(result)).toBe(true);
  });
});
