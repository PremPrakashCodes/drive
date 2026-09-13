"use client";

import { useRef } from "react";
import { Provider } from "react-redux";

import { makeStore, type AppStore } from "./store";

/**
 * Client-side Redux provider for the Next.js App Router.
 *
 * A per-request store instance (ref, never module-level) keeps RSC and future
 * SSR-safe setups from leaking state between requests.
 */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = makeStore();
  }
  return <Provider store={storeRef.current}>{children}</Provider>;
}
