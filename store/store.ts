import { combineReducers, configureStore } from "@reduxjs/toolkit";

import appReducer from "./slices/app";

const rootReducer = combineReducers({
  app: appReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

export const makeStore = () => {
  const store = configureStore({
    reducer: rootReducer,
    // Add middleware (listener middleware, persistence, etc.) here as the app grows.
  });
  return store;
};

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore["dispatch"];
export type Dispatch = AppDispatch;
