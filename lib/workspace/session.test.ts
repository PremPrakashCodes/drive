import { describe, expect, it } from "vitest";

import { isSessionExpired, signInPath } from "./session";

describe("isSessionExpired", () => {
  it("recognises the guard's tagged failure", () => {
    expect(
      isSessionExpired({
        ok: false,
        error: "Your session expired. Sign in again.",
        code: "session-expired",
      })
    ).toBe(true);
  });

  it("leaves every other failure to the toast", () => {
    expect(isSessionExpired({ ok: false, error: "Only the drive owner can rename it." })).toBe(
      false
    );
  });

  it("does not read the message, so rewording the sentence can't fool it", () => {
    expect(isSessionExpired({ ok: false, error: "Your session expired. Sign in again." })).toBe(
      false
    );
  });

  it("is never true for a success", () => {
    expect(isSessionExpired({ ok: true, data: undefined })).toBe(false);
  });
});

describe("signInPath", () => {
  it("brings the person back to the page they were on", () => {
    expect(signInPath({ pathname: "/drive", search: "?folder=abc" })).toBe(
      "/sign-in?next=%2Fdrive%3Ffolder%3Dabc"
    );
  });

  it("works without a query string", () => {
    expect(signInPath({ pathname: "/org/acme/teams" })).toBe("/sign-in?next=%2Forg%2Facme%2Fteams");
  });

  it("refuses to return to an auth route, which would loop", () => {
    expect(signInPath({ pathname: "/sign-in", search: "?next=%2Fdrive" })).toBe(
      "/sign-in?next=%2F"
    );
  });

  it("refuses an off-site return location", () => {
    expect(signInPath({ pathname: "//evil.example.com" })).toBe("/sign-in?next=%2F");
  });
});
