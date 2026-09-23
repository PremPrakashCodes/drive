import type { ActionResult } from "@/types";

const MAX_BATCH = 500;

// Turns a batch server action into a per-item call. A page runs its server
// actions one at a time, so per-file calls would queue up behind each other;
// instead, calls made while a request is in flight wait and go out together
// in the next one.
export function batched<I, O>(send: (inputs: I[]) => Promise<ActionResult<ActionResult<O>[]>>) {
  let queue: { input: I; resolve: (result: ActionResult<O>) => void }[] = [];
  let busy = false;
  async function flush() {
    while (queue.length) {
      const batch = queue.slice(0, MAX_BATCH);
      queue = queue.slice(MAX_BATCH);
      const results = await send(batch.map((b) => b.input)).catch(
        (): ActionResult<ActionResult<O>[]> => ({
          ok: false,
          error: "Couldn't reach the server. Check your connection.",
        })
      );
      batch.forEach((b, i) => b.resolve(results.ok ? results.data[i] : results));
    }
    busy = false;
  }
  return (input: I) =>
    new Promise<ActionResult<O>>((resolve) => {
      queue.push({ input, resolve });
      if (busy) return;
      busy = true;
      // Wait a tick so calls made together (a dropped folder) share a request.
      setTimeout(() => void flush(), 0);
    });
}
