import type { DriveFile } from "./data";

/** Includes every descendant once, even if multiple ancestors are selected. */
export function collectTree(files: DriveFile[], ids: string[]): Set<string> {
  const result = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const file of files) {
      if (file.parent && result.has(file.parent) && !result.has(file.id)) {
        result.add(file.id);
        changed = true;
      }
    }
  }
  return result;
}
export function canMove(files: DriveFile[], ids: string[], destination: string | null): boolean {
  if (destination === null) return true;
  const target = files.find((file) => file.id === destination);
  return (
    !!target &&
    target.kind === "folder" &&
    !target.trashed &&
    !collectTree(files, ids).has(destination)
  );
}
export function copyTree(
  files: DriveFile[],
  ids: string[],
  destination: string | null,
  makeId: () => string
): { files: DriveFile[]; copies: Map<string, string> } {
  const selected = collectTree(files, ids);
  const originals = files.filter((file) => selected.has(file.id) && !file.trashed);
  const copies = new Map(originals.map((file) => [file.id, makeId()]));
  return {
    copies,
    files: originals.map((file) => ({
      ...file,
      id: copies.get(file.id)!,
      name: !file.parent || !selected.has(file.parent) ? `${file.name} (copy)` : file.name,
      parent: file.parent && copies.has(file.parent) ? copies.get(file.parent)! : destination,
      modified: new Date().toISOString(),
    })),
  };
}
