"use client";

import { useDispatch, useSelector, useStore } from "react-redux";

import type { AppDispatch, AppStore, RootState } from "./store";

// Typed Redux hooks (https://redux-toolkit.js.org/tutorials/typescript).
// Always use these instead of the bare react-redux hooks.
// "use client" is required: react-redux's react-server export stubs these
// hooks with functions that lack `.withTypes`, so evaluating this module in a
// server component would crash at runtime.
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<AppStore>();
