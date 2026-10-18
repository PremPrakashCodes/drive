"use client";

import { useEffect } from "react";

// The theme lives on this device (set from the shell's toggle).
function readTheme(): string | undefined {
  try {
    return localStorage.getItem("drive-theme") ?? undefined;
  } catch {
    return undefined;
  }
}

export function useWorkspaceTheme() {
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    // An explicit light/dark choice wins; otherwise follow the device.
    const apply = () => {
      const theme = readTheme();
      document.documentElement.classList.toggle(
        "dark",
        theme === "dark" || (theme !== "light" && media.matches)
      );
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
}
