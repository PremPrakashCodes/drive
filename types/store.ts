// Cross-cutting UI/client state for the application shell (the `app` Redux slice).
export type AppState = {
  /** Global command palette / search overlay. */
  commandOpen: boolean;
  /** Sidebar collapsed preference for this session. */
  sidebarCollapsed: boolean;
  /** Seed for a demo selector; remove once real slices exist. */
  lastActionAt: number | null;
};
