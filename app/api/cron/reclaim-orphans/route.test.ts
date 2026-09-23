import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/cron/reclaim-orphans/route";
import { reclaimOrphans } from "@/lib/drive/orphans";

// `env` snapshots process.env at import, so the secret is stubbed rather than
// set: these tests have to see it both present and missing.
const { env } = vi.hoisted(() => ({ env: { CRON_SECRET: undefined as string | undefined } }));
vi.mock("@/env", () => ({ env }));
vi.mock("@/lib/drive/orphans", () => ({ reclaimOrphans: vi.fn() }));

const SECRET = "cron-secret-of-sixteen-plus";
const request = (authorization?: string) =>
  new Request("https://drive.test/api/cron/reclaim-orphans", {
    headers: authorization ? { authorization } : {},
  }) as NextRequest;

describe("the orphan sweep cron route", () => {
  beforeEach(() => {
    env.CRON_SECRET = SECRET;
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(reclaimOrphans).mockResolvedValue({
      reclaimed: 0,
      unbacked: [],
      skipped: 0,
      failed: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("turns away a request with no bearer token", async () => {
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(reclaimOrphans).not.toHaveBeenCalled();
  });

  it("turns away a request carrying the wrong token", async () => {
    const response = await GET(request("Bearer not-the-secret"));
    expect(response.status).toBe(401);
    expect(reclaimOrphans).not.toHaveBeenCalled();
  });

  it("turns away every request while the secret is unset", async () => {
    env.CRON_SECRET = undefined;
    expect((await GET(request("Bearer undefined"))).status).toBe(401);
    expect((await GET(request(`Bearer ${SECRET}`))).status).toBe(401);
    expect((await GET(request())).status).toBe(401);
    expect(reclaimOrphans).not.toHaveBeenCalled();
  });

  it("sweeps for a request carrying the secret", async () => {
    const response = await GET(request(`Bearer ${SECRET}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ reclaimed: 0 });
  });

  it("reports rows whose object is absent instead of touching them", async () => {
    vi.mocked(reclaimOrphans).mockResolvedValue({
      reclaimed: 2,
      unbacked: ["row-gone"],
      skipped: 0,
      failed: [],
    });

    const response = await GET(request(`Bearer ${SECRET}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ unbacked: ["row-gone"] });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("row-gone"));
  });

  it("answers 500 when a workspace failed, so the run is retried", async () => {
    vi.mocked(reclaimOrphans).mockResolvedValue({
      reclaimed: 0,
      unbacked: [],
      skipped: 0,
      failed: ["workspace"],
    });
    expect((await GET(request(`Bearer ${SECRET}`))).status).toBe(500);
  });
});
