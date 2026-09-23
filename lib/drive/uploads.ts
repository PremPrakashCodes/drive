"use server";

import type { DriveItemKind } from "@/db/schema";
import type { ActionResult, Workspace } from "@/types";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { db } from "@/db";
import { driveItems } from "@/db/schema";
import { Id, parse, run } from "@/lib/drive/action";
import { inOrder, load, placement } from "@/lib/drive/item-queries";
import { workspaceBucket } from "@/lib/drive/s3";
import { DriveError, requireWorkspace } from "@/lib/drive/workspace";
import { MAX_BATCH } from "@/lib/workspace/batch";
import { detectFile, HEAD_BYTES } from "@/lib/workspace/detect";
import { ItemName } from "@/lib/workspace/names";

const MAX_UPLOAD = 5 * 1024 ** 3;

const PrepareInput = z.object({
  parentId: Id.nullable(),
  type: z.string().max(255),
  locked: z.boolean().default(false),
});
const CompleteInput = z.object({
  key: z.string(),
  name: ItemName,
  type: z.string().max(255),
  parentId: Id.nullable(),
  private: z.boolean(),
  locked: z.boolean().default(false),
});
// Only the shape of the batch is checked up front. What is in each file's
// fields is checked inside that file's own result, so a name the drive can't
// take fails that file and leaves the rest of the batch recorded — which is
// what carrying a result per file is for.
const Files = z
  .array(z.unknown())
  .min(1, "No files to upload.")
  .max(MAX_BATCH, `Upload up to ${MAX_BATCH} files at a time.`);

// Checks each destination once per batch, however many files go into it.
function placements(ws: Workspace) {
  const cache = new Map<string, ReturnType<typeof placement>>();
  return (parentId: string | null, locked: boolean) => {
    const key = `${parentId}:${locked}`;
    if (!cache.has(key)) cache.set(key, placement(ws, parentId, locked));
    return cache.get(key)!;
  };
}

// Presigned PUT URLs for a batch of files, each with its own result so one
// bad destination doesn't fail the rest.
export async function prepareUploads(
  input: { parentId: string | null; type: string; locked?: boolean }[]
): Promise<ActionResult<ActionResult<{ key: string; url: string }>[]>> {
  return run(async () => {
    const ws = await requireWorkspace();
    const files = parse(Files, input);
    const place = placements(ws);
    const bucket = await workspaceBucket(ws.id);
    return Promise.all(
      files.map((raw) =>
        run(async () => {
          const file = parse(PrepareInput, raw);
          await place(file.parentId, file.locked);
          const key = `${ws.id}/${randomUUID()}`;
          return { key, url: await bucket.uploadUrl(key, file.type || "application/octet-stream") };
        })
      )
    );
  });
}

// Records a batch of files that reached storage, each with its own result.
export async function completeUploads(
  input: {
    key: string;
    name: string;
    type: string;
    parentId: string | null;
    private: boolean;
    locked?: boolean;
  }[]
): Promise<ActionResult<ActionResult<string>[]>> {
  return run(async () => {
    const ws = await requireWorkspace();
    const files = parse(Files, input);
    const place = placements(ws);
    const bucket = await workspaceBucket(ws.id);
    return Promise.all(
      files.map((raw) =>
        run(async () => {
          const data = parse(CompleteInput, raw);
          const [space, object] = data.key.split("/");
          if (space !== ws.id || !Id.safeParse(object).success)
            throw new DriveError("Invalid upload.");
          const [where, head] = await inOrder(
            place(data.parentId, data.locked),
            bucket.head(data.key).catch(() => null)
          );
          if (!head) throw new DriveError("The upload didn't reach storage. Try again.");
          if ((head.ContentLength ?? 0) > MAX_UPLOAD)
            throw new DriveError("Files can be up to 5 GB.");
          // The type comes from the bytes, not the name. (A range past the end
          // of an empty object is an error, so those skip the read.)
          const start = head.ContentLength
            ? await bucket.peekBytes(data.key, HEAD_BYTES).catch(() => null)
            : new Uint8Array();
          if (!start) throw new DriveError("The upload didn't reach storage. Try again.");
          const detected = await detectFile(start);
          const [row] = await db
            .insert(driveItems)
            .values({
              organizationId: ws.id,
              parentId: where.parent?.id ?? null,
              kind: detected.kind as DriveItemKind,
              name: data.name,
              size: head.ContentLength ?? 0,
              mimeType: detected.mime,
              storageKey: data.key,
              visibility: where.visibility(data.private ? "private" : "shared"),
              lockedAt: where.lockedAt,
              createdById: ws.userId,
            })
            // The key was minted for this one file when the upload was
            // prepared, so a completion sent twice — a retry, a double click,
            // a reconnect — carries the key the first one did. Ignoring the
            // second insert is what keeps two rows off one object.
            .onConflictDoNothing({ target: [driveItems.organizationId, driveItems.storageKey] })
            .returning({ id: driveItems.id });
          if (row) return row.id;
          // Nothing came back, so this upload is already recorded: answer with
          // the row the first call wrote, as if this had been that call.
          const [recorded] = await db
            .select({ id: driveItems.id })
            .from(driveItems)
            .where(and(eq(driveItems.organizationId, ws.id), eq(driveItems.storageKey, data.key)));
          if (!recorded) throw new DriveError("The upload couldn't be saved. Try again.");
          return recorded.id;
        })
      )
    );
  });
}

export async function getFileUrl(id: string, inline = false): Promise<ActionResult<string>> {
  return run(async () => {
    const ws = await requireWorkspace();
    const [item] = await load(ws, [parse(Id, id)]);
    if (!item.storageKey) throw new DriveError("Folders can't be downloaded.");
    return (await workspaceBucket(ws.id)).downloadUrl(
      item.storageKey,
      item.name,
      inline,
      // Players keep requesting ranges while you watch and seek.
      inline && item.kind === "video" ? 6 * 60 * 60 : undefined
    );
  });
}

// The start of a text file, for its grid thumbnail. Read on the server so
// the bucket needs no CORS rules.
export async function getFileSnippet(id: string): Promise<ActionResult<string>> {
  return run(async () => {
    const ws = await requireWorkspace();
    const [item] = await load(ws, [parse(Id, id)]);
    if (!item.storageKey || (item.kind !== "code" && item.kind !== "spreadsheet"))
      throw new DriveError("This file has no text preview.");
    const text = await (await workspaceBucket(ws.id)).peek(item.storageKey, 1500);
    return text.includes("\u0000") ? "" : text;
  });
}
