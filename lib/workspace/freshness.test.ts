import { describe, expect, it } from "vitest";

import { createFreshness } from "./freshness";

describe("createFreshness", () => {
  it("treats the only load in flight as current", () => {
    const freshness = createFreshness();
    const token = freshness.begin();
    expect(freshness.isCurrent(token)).toBe(true);
  });

  it("retires a load as soon as a newer one starts", () => {
    const freshness = createFreshness();
    const first = freshness.begin();
    const second = freshness.begin();
    expect(freshness.isCurrent(first)).toBe(false);
    expect(freshness.isCurrent(second)).toBe(true);
  });

  it("does not let a slow earlier response overwrite a newer one", async () => {
    // The shape of the bug this guards: two reloads overlap and the first
    // server response arrives last. Without the guard the screen ends up
    // showing the older listing.
    const freshness = createFreshness();
    let shown = "nothing";
    const load = async (value: string, delay: number) => {
      const token = freshness.begin();
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (!freshness.isCurrent(token)) return;
      shown = value;
    };
    const slow = load("older", 20);
    // Started second, answers first.
    await load("newer", 0);
    await slow;
    expect(shown).toBe("newer");
  });

  it("keeps the newest response when it is also the slowest", async () => {
    const freshness = createFreshness();
    let shown = "nothing";
    const load = async (value: string, delay: number) => {
      const token = freshness.begin();
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (!freshness.isCurrent(token)) return;
      shown = value;
    };
    const first = load("older", 0);
    const second = load("newer", 20);
    await Promise.all([first, second]);
    expect(shown).toBe("newer");
  });

  it("retires every load in flight when cancelled", () => {
    const freshness = createFreshness();
    const first = freshness.begin();
    const second = freshness.begin();
    freshness.cancel();
    expect(freshness.isCurrent(first)).toBe(false);
    expect(freshness.isCurrent(second)).toBe(false);
  });

  it("goes on issuing current tokens after a cancellation", () => {
    const freshness = createFreshness();
    freshness.begin();
    freshness.cancel();
    const next = freshness.begin();
    expect(freshness.isCurrent(next)).toBe(true);
  });

  it("keeps separate loaders from retiring each other", () => {
    // The drive listing and an organization's overview reload independently:
    // refreshing one must not discard the other's answer.
    const drive = createFreshness();
    const organization = createFreshness();
    const driveToken = drive.begin();
    organization.begin();
    expect(drive.isCurrent(driveToken)).toBe(true);
  });

  it("never reports a token it did not issue as current", () => {
    const freshness = createFreshness();
    freshness.begin();
    expect(freshness.isCurrent(-1)).toBe(false);
    expect(freshness.isCurrent(99)).toBe(false);
  });
});
