import type { AppState } from "@/types";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Cross-cutting UI/client state for the application shell.
 *
 * Scope intentionally small: only state shared by many disconnected parts of
 * the UI belongs here. Server data (drive listings, organizations, uploads)
 * stays in server components, server actions, and local providers — not Redux.
 */
const initialState: AppState = {
  commandOpen: false,
  sidebarCollapsed: false,
  lastActionAt: null,
};

export const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    commandOpenChanged(state, action: PayloadAction<boolean>) {
      state.commandOpen = action.payload;
      state.lastActionAt = Date.now();
    },
    sidebarCollapsedChanged(state, action: PayloadAction<boolean>) {
      state.sidebarCollapsed = action.payload;
      state.lastActionAt = Date.now();
    },
  },
  selectors: {
    selectCommandOpen: (state: AppState) => state.commandOpen,
    selectSidebarCollapsed: (state: AppState) => state.sidebarCollapsed,
  },
});

export const { commandOpenChanged, sidebarCollapsedChanged } = appSlice.actions;

export const { selectCommandOpen, selectSidebarCollapsed } = appSlice.selectors;

export default appSlice.reducer;
