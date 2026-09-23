// How many folder paths one `createFolderTree` request carries. Shared with
// the server action, which refuses a longer list: two copies of this number
// would let the client send a request the server has already decided to turn
// away — which is exactly how a dropped tree of more than a thousand
// directories came to be refused whole.
export const MAX_FOLDER_TREE = 1000;

const key = (path: string[]) => JSON.stringify(path);

// Splits a dropped tree's folder paths into requests the server will accept.
//
// A plain slice can't be used: each request is judged on its own, and the
// server refuses a path whose parent it hasn't seen ("Folders must follow
// their parents"). So every batch carries the ancestors of everything in it,
// even where an earlier batch already made them — repeating an ancestor is
// safe because `createFolderTree` resolves a path that already names a folder
// rather than building a second one beside it.
export function folderBatches(folders: string[][], limit = MAX_FOLDER_TREE): string[][][] {
  // Shallowest first, and each path once: sorting by depth is what guarantees
  // a path is never reached before the ancestors it depends on, whatever order
  // the drop arrived in.
  const paths = [...new Map(folders.filter((p) => p.length).map((p) => [key(p), p])).values()].sort(
    (a, b) => a.length - b.length
  );
  const batches: string[][][] = [];
  let batch: string[][] = [];
  let held = new Set<string>();
  // The path plus whatever of its line this batch isn't already carrying,
  // outermost first — so a parent is always pushed before its child.
  const missing = (path: string[]) =>
    path.map((_, i) => path.slice(0, i + 1)).filter((p) => !held.has(key(p)));
  for (const path of paths) {
    let needed = missing(path);
    if (!needed.length) continue;
    // Starting over means the ancestors this batch was relying on are in the
    // request before it, so they have to be named again here.
    if (batch.length && batch.length + needed.length > limit) {
      batches.push(batch);
      batch = [];
      held = new Set();
      needed = missing(path);
    }
    for (const p of needed) {
      batch.push(p);
      held.add(key(p));
    }
  }
  if (batch.length) batches.push(batch);
  return batches;
}
