import type { UploadEntry } from "@/types";

// OS clutter that folder uploads shouldn't carry into the drive.
const JUNK = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);
export const isJunk = (name: string) => JUNK.has(name);

// A file from an <input>; folder pickers fill in webkitRelativePath.
export const pickedEntry = (file: File): UploadEntry => ({
  file,
  dirs: file.webkitRelativePath.split("/").slice(0, -1),
});

// readEntries hands back children in batches (100 in Chrome) until empty.
function readAll(reader: FileSystemDirectoryReader) {
  return new Promise<FileSystemEntry[]>((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const next = () =>
      reader.readEntries((batch) => {
        if (!batch.length) return resolve(all);
        all.push(...batch);
        next();
      }, reject);
    next();
  });
}

async function walk(entry: FileSystemEntry, dirs: string[], out: UploadEntry[]) {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject)
    );
    out.push({ file, dirs });
  } else if (entry.isDirectory) {
    const children = await readAll((entry as FileSystemDirectoryEntry).createReader());
    await Promise.all(children.map((c) => walk(c, [...dirs, entry.name], out)));
  }
}

const sortKey = (e: UploadEntry) => [...e.dirs, e.file.name].join("/");

// Everything in a drop, descending into dropped folders. `dataTransfer.files`
// alone lists a folder as an empty placeholder file, so entries are walked
// instead. They must be taken synchronously — the list empties once the drop
// event returns.
export function readDrop(data: DataTransfer): Promise<UploadEntry[]> {
  const entries = Array.from(data.items)
    .filter((i) => i.kind === "file")
    .map((i) => i.webkitGetAsEntry())
    .filter((e): e is FileSystemEntry => e !== null);
  if (!entries.length)
    return Promise.resolve(Array.from(data.files, (file) => ({ file, dirs: [] })));
  const out: UploadEntry[] = [];
  return Promise.all(entries.map((e) => walk(e, [], out))).then(() =>
    // Walking is concurrent; queue files in the order a file browser shows them.
    out.sort((a, b) => sortKey(a).localeCompare(sortKey(b), undefined, { numeric: true }))
  );
}
