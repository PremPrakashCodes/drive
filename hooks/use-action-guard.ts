"use client";

import type { ActionGuard } from "@/types";
import { useCallback, useRef, useState } from "react";

// One intent, one dispatch.
//
// A `pending` flag on its own can't do this: React re-renders after the click
// handler returns, so a second click landing in that gap still finds an
// enabled control and a stale `pending`. The ref is written synchronously, so
// the second call is already too late by the time it reads it. The flag is
// still needed — it is what disables the control and labels it as working.
//
// This is a per-tab control, not deduplication: two tabs, or a direct POST,
// still send two requests. It closes the double-click, which is the one
// people actually hit.
export function useActionGuard(): ActionGuard {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const run = useCallback(async <T>(action: () => Promise<T>): Promise<T | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setPending(true);
    try {
      return await action();
    } finally {
      // Released before the caller's code after `await` runs, so a confirm
      // dialog that stays open on failure comes back enabled.
      inFlight.current = false;
      setPending(false);
    }
  }, []);
  return { pending, run };
}
