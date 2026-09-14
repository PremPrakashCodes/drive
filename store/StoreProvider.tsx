"use client";

import { useState } from "react";
import { Provider } from "react-redux";

import { makeStore } from "./store";

/**
 * Client-side Redux provider for the Next.js App Router.
 *
 * A per-request store instance (component state, never module-level) keeps RSC and future
 * SSR-safe setups from leaking state between requests.
 */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  // The lazy initializer runs once per mount.
  const [store] = useState(makeStore);
  return <Provider store={store}>{children}</Provider>;
}
