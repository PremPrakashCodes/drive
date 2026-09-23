import { describe, expect, it } from "vitest";

import { parsers } from "./constants";

// Every URL parameter the file browser owns, and what it is: a place you can
// go back from, or a way of looking at the place you are already in.
//
// This is a `Record` over `keyof typeof parsers` on purpose: adding a
// parameter without deciding its role stops type-checking here, and getting
// the role wrong stops the test below. The distinction is not cosmetic — a
// filter that pushes buries the page the person came from under one history
// entry per adjustment, so Back stops leaving the view.
const roles: Record<keyof typeof parsers, "push" | "replace"> = {
  // Navigation: where you are.
  folder: "push",
  view: "push",
  // Filters: how what you are looking at is shown.
  search: "replace",
  layout: "replace",
  sort: "replace",
  direction: "replace",
  type: "replace",
  owner: "replace",
  modified: "replace",
  page: "replace",
};

describe("file browser query parameters", () => {
  it("gives every parameter a role", () => {
    expect(Object.keys(parsers).sort()).toEqual(Object.keys(roles).sort());
  });

  // nuqs reads `parser.history` before the hook's own option
  // (`callOptions.history ?? parser.history ?? history`), so declaring the
  // role on the parser is what makes a mixed update behave: the throttle
  // queue merges a batch into one URL write and upgrades it to a push only
  // when one of the queued parameters asked for it.
  for (const [key, role] of Object.entries(roles)) {
    it(`treats ${key} as a ${role === "push" ? "navigation" : "filter"} parameter`, () => {
      expect(parsers[key as keyof typeof parsers].history ?? "replace").toBe(role);
    });
  }

  it("keeps navigation parameters unset rather than defaulted", () => {
    // A folder or preview that defaulted to a value would put the person
    // somewhere they never navigated to. (Typed absent too: these are
    // `SingleParserBuilder`s, which have no `defaultValue` at all.)
    expect("defaultValue" in parsers.folder).toBe(false);
    expect("defaultValue" in parsers.view).toBe(false);
  });
});
