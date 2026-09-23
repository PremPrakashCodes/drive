import { describe, expect, it } from "vitest";

import { folderBatches, MAX_FOLDER_TREE } from "@/lib/workspace/folder-batches";

const key = (path: string[]) => path.join("/");

// The rule the server holds every request to — "Folders must follow their
// parents" — checked per batch, because each batch is its own request and
// knows nothing of what an earlier one carried beyond the folders it made.
const parentsFirst = (batch: string[][]) => {
  const seen = new Set<string>();
  for (const path of batch) {
    if (path.length > 1 && !seen.has(key(path.slice(0, -1)))) return false;
    seen.add(key(path));
  }
  return true;
};

// A dropped folder as the provider builds it: every directory on the way to a
// file, so `tops` top-level folders each holding `children` subfolders.
const drop = (tops: number, children: number) =>
  Array.from({ length: tops }, (_, t) => [`top-${t}`]).flatMap((top) => [
    top,
    ...Array.from({ length: children }, (_, c) => [...top, `sub-${c}`]),
  ]);

// A drop of more than a thousand directories used to be handed over whole and
// refused outright by the server's cap. Splitting it is only safe if every
// piece is a request the server would have accepted on its own.
describe("splitting a dropped tree into requests the server will take", () => {
  it("keeps every batch inside the cap one request carries", () => {
    const folders = drop(100, 11);
    expect(folders).toHaveLength(1200);

    const batches = folderBatches(folders);

    expect(batches.length).toBeGreaterThan(1);
    for (const batch of batches) expect(batch.length).toBeLessThanOrEqual(MAX_FOLDER_TREE);
  });

  it("carries every folder of the drop", () => {
    const folders = drop(100, 11);

    const carried = new Set(folderBatches(folders).flat().map(key));

    expect(carried).toEqual(new Set(folders.map(key)));
  });

  it("lists a path's parent before it in the batch that holds it", () => {
    for (const batch of folderBatches(drop(100, 11))) expect(parentsFirst(batch)).toBe(true);
  });

  it("repeats the ancestors a split left behind in an earlier batch", () => {
    // Deep enough that a split has to land inside one top-level folder's
    // children, so the batch after it cannot name them without their parent.
    const folders = drop(4, 400);

    const batches = folderBatches(folders);

    expect(batches.length).toBeGreaterThan(1);
    const repeated = batches
      .slice(1)
      .flatMap((batch) => batch.filter((path) => path.length === 1).map(key));
    expect(repeated.length).toBeGreaterThan(0);
    // Repeating one is only safe because the server resolves a path that
    // already names a folder rather than making a second one beside it.
    for (const batch of batches) expect(parentsFirst(batch)).toBe(true);
  });

  it("sends a drop that already fits as one request", () => {
    const folders = drop(10, 9);

    const batches = folderBatches(folders);

    expect(batches).toHaveLength(1);
    expect(new Set(batches[0].map(key))).toEqual(new Set(folders.map(key)));
  });

  it("honours a smaller limit, for a tree whose depth still fits", () => {
    const batches = folderBatches(drop(5, 5), 8);

    for (const batch of batches) {
      expect(batch.length).toBeLessThanOrEqual(8);
      expect(parentsFirst(batch)).toBe(true);
    }
    expect(new Set(batches.flat().map(key)).size).toBe(30);
  });
});

describe("what a batch of folder paths leaves out", () => {
  it("counts a path the drop lists twice once", () => {
    expect(folderBatches([["Trip"], ["Trip"], ["Trip", "Photos"]])).toEqual([
      [["Trip"], ["Trip", "Photos"]],
    ]);
  });

  it("puts a shuffled drop in parent-first order", () => {
    const batches = folderBatches([["Trip", "Photos", "Raw"], ["Trip"], ["Trip", "Photos"]]);

    expect(batches).toEqual([[["Trip"], ["Trip", "Photos"], ["Trip", "Photos", "Raw"]]]);
  });

  it("fills in an ancestor the drop never named", () => {
    // The provider always sends every ancestor, but a batch missing one would
    // be refused by the server, so the split supplies it rather than relying
    // on that.
    expect(folderBatches([["Trip", "Photos"]])).toEqual([[["Trip"], ["Trip", "Photos"]]]);
  });

  it("has nothing to send for a drop with no folders", () => {
    expect(folderBatches([])).toEqual([]);
    expect(folderBatches([[]])).toEqual([]);
  });
});
