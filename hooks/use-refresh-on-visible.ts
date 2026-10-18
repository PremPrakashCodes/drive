"use client";

import { useEffect } from "react";

export function useRefreshOnVisible(refresh: () => Promise<void>, cancel: () => void) {
  useEffect(() => {
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancel();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, cancel]);
}
