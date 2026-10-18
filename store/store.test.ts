import { describe, expect, it } from "vitest";

import {
  commandOpenChanged,
  commandOpenToggled,
  newFolderOpenChanged,
  selectCommandOpen,
  selectNewFolderOpen,
} from "./slices/app";
import { makeStore } from "./store";

describe("workspace UI store", () => {
  it("isolates UI state between requests and fresh workspace mounts", () => {
    const first = makeStore();
    first.dispatch(commandOpenChanged(true));
    first.dispatch(newFolderOpenChanged(true));

    const second = makeStore();
    expect(selectCommandOpen(second.getState())).toBe(false);
    expect(selectNewFolderOpen(second.getState())).toBe(false);
    expect(selectCommandOpen(first.getState())).toBe(true);
    expect(selectNewFolderOpen(first.getState())).toBe(true);
  });

  it("toggles from the latest store state across keyboard and button actions", () => {
    const store = makeStore();
    store.dispatch(commandOpenChanged(true));
    store.dispatch(commandOpenToggled());
    expect(selectCommandOpen(store.getState())).toBe(false);

    store.dispatch(newFolderOpenChanged(true));
    store.dispatch(commandOpenToggled());
    store.dispatch(commandOpenToggled());
    expect(selectCommandOpen(store.getState())).toBe(false);
    expect(selectNewFolderOpen(store.getState())).toBe(true);
  });
});
