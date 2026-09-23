// Cross-cutting UI/client state for the application shell (the `app` Redux slice).
export type AppState = {
  /** Global command palette / search overlay. */
  commandOpen: boolean;
  /** Sidebar collapsed preference for this session. */
  sidebarCollapsed: boolean;
  /** Seed for a demo selector; remove once real slices exist. */
  lastActionAt: number | null;
};

// A mutating control's in-flight state (`hooks/use-action-guard.ts`).
export type ActionGuard = {
  /** True while the guarded action is running: disables and labels the control. */
  pending: boolean;
  /**
   * Runs `action` unless one is already in flight, in which case it resolves
   * to `undefined` without dispatching anything.
   */
  run: <T>(action: () => Promise<T>) => Promise<T | undefined>;
};
