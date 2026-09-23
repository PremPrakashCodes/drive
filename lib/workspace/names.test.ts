import { describe, expect, it } from "vitest";

import { compareNames } from "@/lib/workspace/names";

const sorted = (names: string[]) => [...names].sort(compareNames);

// Numbered files are how people name a series they intend to be read in
// order, and code-unit order takes that series apart: it compares "1" to "2"
// and stops, so every name starting with 1 lands before "2 - ...".
describe("ordering names that carry numbers", () => {
  it("counts a run of digits as the number it spells", () => {
    expect(sorted(["10 - Amazon", "2 - Session 1", "1 - Welcome"])).toEqual([
      "1 - Welcome",
      "2 - Session 1",
      "10 - Amazon",
    ]);
  });

  // The real list this was found on: twelve recordings whose order is the
  // only thing saying which to watch next.
  it("keeps a numbered series in the order it was named", () => {
    const names = [
      "1 - Bonus Live Session 1 (Welcome).ts",
      "10 - Bonus Mentorship Session (Amazon).ts",
      "11 - Bonus Live for Internship Season.ts",
      "12 - Bonus Live for Placement Season.ts",
      "2 - Live Mentorship Session 1.ts",
      "3 - Bonus Live Class (Recursion).ts",
      "9 - Live Mentorship Session 7 (Interview Preparation).ts",
    ];
    expect(sorted(names).map((n) => n.slice(0, n.indexOf(" ")))).toEqual([
      "1",
      "2",
      "3",
      "9",
      "10",
      "11",
      "12",
    ]);
  });

  // A separator that isn't there is what "7- Live ..." has, and it shouldn't
  // move the file out of the run.
  it("reads the number whatever follows it", () => {
    expect(sorted(["8 - Session 6.ts", "7- Session 5.ts", "10 - Amazon.ts"])).toEqual([
      "7- Session 5.ts",
      "8 - Session 6.ts",
      "10 - Amazon.ts",
    ]);
  });

  it("still orders names with no digits in them", () => {
    expect(sorted(["Reports", "Archive", "budget"])).toEqual(["Archive", "budget", "Reports"]);
  });

  it("reports a tie as a tie, so a sort can fall through to the next key", () => {
    expect(compareNames("Session 2.ts", "Session 2.ts")).toBe(0);
  });
});
