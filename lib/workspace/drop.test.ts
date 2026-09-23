import { describe, expect, it } from "vitest";

import { isJunk, pickedEntry, readDrop } from "@/lib/workspace/drop";

// Stand-ins for the DOM's drag-and-drop entry APIs. Everything here is a
// plain object cast to the DOM type — no jsdom needed since `readDrop` only
// calls a handful of methods on what it's handed.

// A leaf: `file()` (Chrome's, callback-based) hands back the File it wraps.
function fileEntry(name: string, file: File): FileSystemEntry {
  return {
    name,
    isFile: true,
    isDirectory: false,
    file: (resolve: (file: File) => void) => resolve(file),
  } as unknown as FileSystemEntry;
}

// A directory whose reader replies with one `batches[call]` per call to
// `readEntries`, advancing on each call — exactly how Chrome pages a large
// folder (100 entries at a time) until a call comes back empty.
function dirEntry(name: string, batches: FileSystemEntry[][]): FileSystemEntry {
  let call = 0;
  return {
    name,
    isFile: false,
    isDirectory: true,
    createReader: () => ({
      readEntries: (resolve: (batch: FileSystemEntry[]) => void) => {
        const batch = batches[call] ?? [];
        call++;
        resolve(batch);
      },
    }),
  } as unknown as FileSystemEntry;
}

// A `DataTransfer` whose `items` resolve to the given top-level entries (or
// nothing, to exercise the `data.files` fallback) and whose `files` list is
// what the browser always populates alongside `items`.
function dataTransfer(entries: (FileSystemEntry | null)[], files: File[] = []): DataTransfer {
  return {
    items: entries.map((entry) => ({
      kind: "file",
      webkitGetAsEntry: () => entry,
    })),
    files,
  } as unknown as DataTransfer;
}

const file = (name: string) => new File(["x"], name);

describe("readDrop", () => {
  it("pages a large folder through readEntries until a batch comes back empty", async () => {
    // Chrome hands back at most 100 entries per call; a folder with more than
    // that only shows up in full if the caller keeps calling until empty.
    const first = Array.from({ length: 100 }, (_, i) => fileEntry(`a${i}`, file(`a${i}`)));
    const second = Array.from({ length: 30 }, (_, i) => fileEntry(`b${i}`, file(`b${i}`)));
    const folder = dirEntry("Big", [first, second, []]);

    const result = await readDrop(dataTransfer([folder]));

    expect(result).toHaveLength(130);
  });

  it("builds each file's dirs outermost-first while walking nested folders", async () => {
    const leaf = fileEntry("a.txt", file("a.txt"));
    const sub = dirEntry("Sub", [[leaf], []]);
    const root = dirEntry("Folder", [[sub], []]);

    const result = await readDrop(dataTransfer([root]));

    expect(result).toEqual([{ file: expect.any(File), dirs: ["Folder", "Sub"] }]);
  });

  it("sorts numerically so file2 comes before file10", async () => {
    // Plain lexicographic order would put "file10" first ('1' < '2' but the
    // whole string compares by character); `numeric: true` fixes that.
    const entries = [fileEntry("file10", file("file10")), fileEntry("file2", file("file2"))];

    const result = await readDrop(dataTransfer(entries));

    expect(result.map((e) => e.file.name)).toEqual(["file2", "file10"]);
  });

  it("falls back to data.files when webkitGetAsEntry yields nothing", async () => {
    // Safari, or a drag with no directory entries at all: `items` resolves to
    // no usable entries, so the walk never starts and `files` is used as-is.
    const a = file("a.txt");
    const b = file("b.txt");

    const result = await readDrop(dataTransfer([null], [a, b]));

    expect(result).toEqual([
      { file: a, dirs: [] },
      { file: b, dirs: [] },
    ]);
  });
});

// isJunk exists in this module, but nothing in `readDrop`/`walk` calls it —
// junk filtering for a folder drop is not wired up. (Only the picker's
// `pickedEntry` path filters, in components/upload/upload-provider.tsx.) So
// no "readDrop skips .DS_Store" test is added here: it would fail, and
// production code is out of scope for this pass.
describe("isJunk", () => {
  it("flags known OS clutter by name", () => {
    expect(isJunk(".DS_Store")).toBe(true);
    expect(isJunk("Thumbs.db")).toBe(true);
    expect(isJunk("desktop.ini")).toBe(true);
  });

  it("leaves ordinary file names alone", () => {
    expect(isJunk("report.pdf")).toBe(false);
  });
});

describe("pickedEntry", () => {
  it("splits webkitRelativePath into dirs, dropping the file's own name", () => {
    const picked = file("notes.txt");
    Object.defineProperty(picked, "webkitRelativePath", { value: "Trip/Photos/notes.txt" });

    expect(pickedEntry(picked)).toEqual({ file: picked, dirs: ["Trip", "Photos"] });
  });

  it("has no dirs for a file picked without a folder", () => {
    const picked = file("notes.txt");
    Object.defineProperty(picked, "webkitRelativePath", { value: "" });

    expect(pickedEntry(picked)).toEqual({ file: picked, dirs: [] });
  });
});
