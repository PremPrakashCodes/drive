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
  newFolderOpen: false,
};

export const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    commandOpenChanged(state, action: PayloadAction<boolean>) {
      state.commandOpen = action.payload;
    },
    commandOpenToggled(state) {
      state.commandOpen = !state.commandOpen;
    },
    newFolderOpenChanged(state, action: PayloadAction<boolean>) {
      state.newFolderOpen = action.payload;
    },
  },
  selectors: {
    selectCommandOpen: (state: AppState) => state.commandOpen,
    selectNewFolderOpen: (state: AppState) => state.newFolderOpen,
  },
});

export const { commandOpenChanged, commandOpenToggled, newFolderOpenChanged } = appSlice.actions;

export const { selectCommandOpen, selectNewFolderOpen } = appSlice.selectors;

export default appSlice.reducer;
