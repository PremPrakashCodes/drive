import type { ActionResult } from "@/types";
import { describe, expect, it, vi } from "vitest";

import { batched, MAX_BATCH } from "@/lib/workspace/batch";

const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
const no = (error: string): ActionResult<never> => ({ ok: false, error });

// Whether `promise` is still waiting once the event loop has had a turn. A
// caller left hanging is the failure these tests are looking for, and without
// this it shows up as a suite that times out rather than an assertion.
const waiting = async (promise: Promise<unknown>) => {
  const held = Symbol("held");
  return (
    (await Promise.race([promise, new Promise((r) => setTimeout(() => r(held), 20))])) === held
  );
};

// Answers with whatever each call is handed, one canned answer per call.
const answering = <I, O>(...answers: ActionResult<ActionResult<O>[]>[]) => {
  const sent: I[][] = [];
  const send = vi.fn(async (inputs: I[]) => {
    sent.push(inputs);
    return answers[sent.length - 1] ?? no("no answer prepared");
  });
  return { send, sent };
};

describe("batching per-file calls into one request", () => {
  it("sends the calls made in one tick together", async () => {
    const { send, sent } = answering<number, number>(ok([ok(2), ok(4)]));
    const call = batched(send);

    const results = await Promise.all([call(1), call(2)]);

    expect(sent).toEqual([[1, 2]]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(results).toEqual([ok(2), ok(4)]);
  });

  it("hands each caller its own file's answer", async () => {
    const { send } = answering<number, number>(ok([no("that one is no good"), ok(4)]));
    const call = batched(send);

    expect(await Promise.all([call(1), call(2)])).toEqual([no("that one is no good"), ok(4)]);
  });

  it("gives every caller the same error when the call itself failed", async () => {
    const { send } = answering<number, number>(no("not signed in"));
    const call = batched(send);

    expect(await Promise.all([call(1), call(2)])).toEqual([
      no("not signed in"),
      no("not signed in"),
    ]);
  });

  it("answers every caller when the request never arrives", async () => {
    const send = vi.fn(async () => {
      throw new Error("offline");
    });
    const call = batched<number, number>(send);

    expect(await Promise.all([call(1), call(2)])).toEqual([
      { ok: false, error: expect.any(String) },
      { ok: false, error: expect.any(String) },
    ]);
  });

  it("takes the next call after a request that never arrived", async () => {
    const send = vi
      .fn<(inputs: number[]) => Promise<ActionResult<ActionResult<number>[]>>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(ok([ok(4)]));
    const call = batched(send);

    await call(1);

    expect(await call(2)).toEqual(ok(4));
  });

  // The answer is read by index, so a short one used to hand a caller
  // `undefined` in place of its result — a result shape it then walked into.
  it("says so when the answer covers fewer files than were sent", async () => {
    const { send } = answering<number, number>(ok([ok(2)]));
    const call = batched(send);

    const results = await Promise.all([call(1), call(2)]);

    expect(results).toEqual([
      { ok: false, error: expect.any(String) },
      { ok: false, error: expect.any(String) },
    ]);
  });

  // An answer that isn't a list at all used to throw while the results were
  // being handed out, which left the in-flight flag set: nothing would ever
  // start another request, so every later call waited forever.
  it("keeps taking calls after an answer it couldn't read", async () => {
    const send = vi
      .fn<(inputs: number[]) => Promise<ActionResult<ActionResult<number>[]>>>()
      .mockResolvedValueOnce(ok(null as never))
      .mockResolvedValueOnce(ok([ok(4)]));
    const call = batched(send);

    const first = call(1);
    expect(await waiting(first)).toBe(false);
    expect(await first).toEqual({ ok: false, error: expect.any(String) });

    const second = call(2);
    expect(await waiting(second)).toBe(false);
    expect(await second).toEqual(ok(4));
  });

  it("splits a queue bigger than one request into whole batches", async () => {
    const answer = (n: number) => ok(Array.from({ length: n }, (_, i) => ok(i)));
    const { send, sent } = answering<number, number>(answer(MAX_BATCH), answer(1));
    const call = batched(send);

    await Promise.all(Array.from({ length: MAX_BATCH + 1 }, (_, i) => call(i)));

    expect(sent.map((batch) => batch.length)).toEqual([MAX_BATCH, 1]);
  });
});
