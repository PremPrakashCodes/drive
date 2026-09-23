import type { ActionResult } from "@/types";

// How many files one request carries. Shared with the server actions on the
// other end, which refuse a longer list: two copies of this number would let
// the client send a batch the server has already decided to turn away.
export const MAX_BATCH = 500;

// Turns a batch server action into a per-item call. A page runs its server
// actions one at a time, so per-file calls would queue up behind each other;
// instead, calls made while a request is in flight wait and go out together
// in the next one.
export function batched<I, O>(send: (inputs: I[]) => Promise<ActionResult<ActionResult<O>[]>>) {
  let queue: { input: I; resolve: (result: ActionResult<O>) => void }[] = [];
  let busy = false;
  async function flush() {
    try {
      while (queue.length) {
        const batch = queue.slice(0, MAX_BATCH);
        queue = queue.slice(MAX_BATCH);
        const results = await send(batch.map((b) => b.input)).catch(
          (): ActionResult<ActionResult<O>[]> => ({
            ok: false,
            error: "Couldn't reach the server. Check your connection.",
          })
        );
        // One answer per file is the contract. An answer that doesn't line up
        // with what went out has to be said out loud: reading it by index
        // otherwise hands a caller `undefined` as its result, and whatever it
        // does with that happens far from here.
        const aligned = results.ok && Array.isArray(results.data);
        const short = aligned && results.data.length !== batch.length;
        batch.forEach((b, i) =>
          b.resolve(
            !results.ok
              ? results
              : aligned && !short
                ? results.data[i]
                : { ok: false, error: "The server answered for a different set of files." }
          )
        );
      }
    } finally {
      // Whatever the answer did on the way out, the next call has to be able
      // to start a request: a flag left set here holds every later upload.
      busy = false;
    }
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
