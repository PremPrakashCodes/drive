import type { ActionResult } from "@/types";
import { describe, expect, it } from "vitest";

import { describeBatch } from "@/lib/workspace/outcome";

const ok: ActionResult<unknown> = { ok: true, data: null };
const bad = (error: string): ActionResult<unknown> => ({ ok: false, error });
const run = (...items: [string, ActionResult<unknown>][]) =>
  describeBatch(
    items.map(([name, result]) => ({ name, result })),
    "Shared with the drive"
  );

describe("describeBatch", () => {
  it("reports success only when every item applied", () => {
    const outcome = run(["a.txt", ok], ["b.txt", ok]);
    expect(outcome.kind).toBe("applied");
    expect(outcome.message).toBe("Shared with the drive");
    expect(outcome.failed).toEqual([]);
  });

  it("never calls a partial run a success", () => {
    const outcome = run(["a.txt", ok], ["b.txt", bad("You can't edit this file.")]);
    expect(outcome.kind).toBe("partial");
    expect(outcome.applied).toEqual(["a.txt"]);
  });

  it("names what did not apply, and how much did", () => {
    const outcome = run(
      ["a.txt", ok],
      ["b.txt", bad("You can't edit this file.")],
      ["c.txt", bad("You can't edit this file.")]
    );
    expect(outcome.message).toBe("1 of 3 changed. b.txt, c.txt didn't: You can't edit this file.");
  });

  it("counts the rest once the list of names gets long", () => {
    const outcome = run(
      ["a.txt", ok],
      ...(["b", "c", "d", "e"].map((n) => [`${n}.txt`, bad("Nope.")]) as [
        string,
        ActionResult<unknown>,
      ][])
    );
    expect(outcome.message).toBe("1 of 5 changed. b.txt, c.txt, d.txt and 1 more didn't: Nope.");
  });

  it("gives the reason alone when a single item fails and nothing applied", () => {
    const outcome = run(["a.txt", bad("You can't edit this file.")]);
    expect(outcome.kind).toBe("failed");
    expect(outcome.message).toBe("You can't edit this file.");
  });

  it("names the files when a whole multi-file run fails", () => {
    const outcome = run(["a.txt", bad("Nope.")], ["b.txt", bad("Nope.")]);
    expect(outcome.kind).toBe("failed");
    expect(outcome.message).toBe("a.txt, b.txt: Nope.");
  });

  it("treats an empty run as nothing to report against", () => {
    expect(describeBatch([], "Shared with the drive").kind).toBe("applied");
  });
});
