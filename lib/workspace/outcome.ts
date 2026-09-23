import type { ActionResult, BatchOutcome } from "@/types";

// How many names a failure line spells out before it counts the rest.
const NAMED = 3;

function nameList(names: string[]) {
  if (names.length <= NAMED) return names.join(", ");
  return `${names.slice(0, NAMED).join(", ")} and ${names.length - NAMED} more`;
}

// Folds a per-item run into the one thing the person is told.
//
// The rule it exists to keep: a run where some items failed is never reported
// as a success. A partial run says how much of it applied and names what did
// not, so nobody has to re-open files to find out.
export function describeBatch(
  results: { name: string; result: ActionResult<unknown> }[],
  success: string
): BatchOutcome {
  const applied = results.filter((r) => r.result.ok).map((r) => r.name);
  const failed = results.flatMap((r) =>
    r.result.ok ? [] : [{ name: r.name, error: r.result.error }]
  );
  if (!failed.length) return { kind: "applied", applied, failed, message: success };
  const reason = failed[0].error;
  if (!applied.length)
    return {
      kind: "failed",
      applied,
      failed,
      message: failed.length === 1 ? reason : `${nameList(failed.map((f) => f.name))}: ${reason}`,
    };
  return {
    kind: "partial",
    applied,
    failed,
    message: `${applied.length} of ${results.length} changed. ${nameList(
      failed.map((f) => f.name)
    )} didn't: ${reason}`,
  };
}
