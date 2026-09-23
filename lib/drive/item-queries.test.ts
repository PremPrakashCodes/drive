import type { DriveItem } from "@/db/schema";
import type { Workspace } from "@/types";
import type { SQL } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { MAX_TREE_DEPTH } from "@/lib/drive/action";
import { descendants } from "@/lib/drive/item-queries";
import { DriveError } from "@/lib/drive/workspace";

const ws: Workspace = {
  id: randomUUID(),
  name: "Test drive",
  role: "owner",
  userId: randomUUID(),
  own: true,
  kind: "personal",
};

const row = (over: Partial<DriveItem> = {}): DriveItem => ({
  id: randomUUID(),
  organizationId: ws.id,
  parentId: null,
  kind: "folder",
  name: "Trip",
  size: 0,
  mimeType: null,
  storageKey: null,
  visibility: "shared",
  color: null,
  createdById: ws.userId,
  trashedAt: null,
  lockedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

// Drizzle renders a condition to SQL plus its bind parameters. Reading them
// back is what lets a stub answer the real query with a made-up tree — and
// what lets a test see how the walk split a wide level.
const bindings = (condition: SQL) =>
  (
    db as unknown as { dialect: { sqlToQuery(sql: SQL): { params: unknown[] } } }
  ).dialect.sqlToQuery(condition).params as string[];

// Stands in for the drive_items table. Every read the walk makes is answered
// from `childrenOf` and recorded, and the read budget makes a walk that never
// finishes fail the test instead of hanging it.
function table(childrenOf: (id: string) => DriveItem[], budget = MAX_TREE_DEPTH * 4) {
  const reads: { organizationId: string; ids: string[] }[] = [];
  vi.spyOn(db, "select").mockImplementation((() => ({
    from: () => ({
      where: async (condition: SQL) => {
        const [organizationId, ...ids] = bindings(condition);
        if (reads.length >= budget)
          throw new Error(`the walk made ${budget} reads without finishing`);
        reads.push({ organizationId, ids });
        return ids.flatMap(childrenOf);
      },
    }),
  })) as never);
  return reads;
}

// A tree held as parent -> children, so a read answers whatever the walk asks
// for rather than a script fixed in advance.
function children(items: DriveItem[]) {
  const byParent = new Map<string, DriveItem[]>();
  for (const item of items)
    if (item.parentId) byParent.set(item.parentId, [...(byParent.get(item.parentId) ?? []), item]);
  return (id: string) => byParent.get(id) ?? [];
}

// A chain of `length` folders, outermost first, hanging off `parentId`.
function chain(length: number, parentId: string | null) {
  const items: DriveItem[] = [];
  for (let i = 0; i < length; i++) {
    const item = row({ parentId: i === 0 ? parentId : items[i - 1].id, name: `Level ${i + 1}` });
    items.push(item);
  }
  return items;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("walking a subtree", () => {
  it("returns each descendant once when a folder and its own subfolder are selected", async () => {
    // Both are easy to select together: a flat screen lists them side by side,
    // and select-all takes the lot.
    const folder = row({ name: "Trip" });
    const subfolder = row({ parentId: folder.id, name: "Photos" });
    const file = row({ parentId: subfolder.id, kind: "document", name: "Beach.jpg" });
    table(children([subfolder, file]));

    const found = await descendants(ws, [folder.id, subfolder.id]);

    // The subfolder is still a descendant — `selection` needs it there to know
    // it isn't a root — but it appears once, and so does everything under it.
    expect(found.map((i) => i.id).sort()).toEqual([subfolder.id, file.id].sort());
  });

  it("keeps every read inside the caller's workspace", async () => {
    const folder = row();
    const child = row({ parentId: folder.id });
    const reads = table(children([child]));

    await descendants(ws, [folder.id]);

    expect(reads.length).toBeGreaterThan(0);
    expect(reads.every((r) => r.organizationId === ws.id)).toBe(true);
  });

  it("stops at a parent cycle instead of walking it forever", async () => {
    // Two concurrent moves can leave a folder inside its own descendant; the
    // walk has to terminate on it whatever the writes allowed.
    const first = row({ name: "A" });
    const second = row({ parentId: first.id, name: "B" });
    const looped = row({ ...first, parentId: second.id });
    const outer = row({ name: "Outer" });
    table(children([row({ ...first, parentId: outer.id }), second, looped]));

    const found = await descendants(ws, [outer.id]);

    expect(found.map((i) => i.id).sort()).toEqual([first.id, second.id].sort());
  });

  it("returns a chain that stays within the cap in full", async () => {
    const root = row({ name: "Root" });
    const deep = chain(MAX_TREE_DEPTH - 1, root.id);
    table(children(deep));

    const found = await descendants(ws, [root.id]);

    expect(found.map((i) => i.id)).toEqual(deep.map((i) => i.id));
  });

  it("refuses a tree deeper than the cap rather than returning part of it", async () => {
    // An endless chain: every folder read has one more folder inside it.
    const next = new Map<string, DriveItem>();
    const root = row({ name: "Root" });
    const reads = table((id) => {
      if (!next.has(id)) next.set(id, row({ parentId: id }));
      return [next.get(id)!];
    });

    const failure = await descendants(ws, [root.id]).catch((error: unknown) => error);

    // Stated, so the caller refuses the whole mutation rather than applying it
    // to the part of the tree it managed to read.
    expect(failure).toBeInstanceOf(DriveError);
    expect((failure as DriveError).message).toMatch(/nested too deeply/i);
    // Bounded: it gave up at the cap rather than reading on.
    expect(reads).toHaveLength(MAX_TREE_DEPTH);
  });

  it("reads a wide level in chunks and returns all of it", async () => {
    // A dropped directory lands at once, so one level can hold thousands of
    // items — more `IN (...)` parameters than a statement may bind.
    const root = row({ name: "Root" });
    const wide = Array.from({ length: 1200 }, () => row({ parentId: root.id, kind: "document" }));
    const reads = table(children(wide));

    const found = await descendants(ws, [root.id]);

    expect(found).toHaveLength(1200);
    expect(reads.every((r) => r.ids.length <= 500)).toBe(true);
    // The 1200 children are asked about across three reads, not one.
    expect(reads.slice(1).map((r) => r.ids.length)).toEqual([500, 500, 200]);
  });
});
