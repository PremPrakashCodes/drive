"use server";

import type { ActionResult } from "@/types";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { storageConnections, storageProviders } from "@/db/schema";
import { parse, run } from "@/lib/drive/action";
import { encryptJson } from "@/lib/drive/crypto";
import { bucket, workspaceBucket } from "@/lib/drive/s3";
import { DriveError, requireOwner, requireWorkspace } from "@/lib/drive/workspace";

const catalog = {
  s3: { displayName: "Amazon S3", icon: "aws" },
  r2: { displayName: "Cloudflare R2", icon: "cloudflare" },
} as const;

const Connection = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("s3"),
    bucket: z.string().trim().min(3, "Enter the bucket name.").max(63),
    region: z.string().trim().min(1, "Enter the bucket's region.").max(40),
    accessKeyId: z.string().trim().min(1, "Enter the access key ID."),
    secretAccessKey: z.string().min(1, "Enter the secret access key."),
  }),
  z.object({
    provider: z.literal("r2"),
    bucket: z.string().trim().min(3, "Enter the bucket name.").max(63),
    endpoint: z
      .url({ protocol: /^https$/, error: "Enter your R2 endpoint URL." })
      .refine(
        (v) => new URL(v).hostname.endsWith(".r2.cloudflarestorage.com"),
        "Use your account endpoint, e.g. https://<account-id>.r2.cloudflarestorage.com"
      ),
    accessKeyId: z.string().trim().min(1, "Enter the access key ID."),
    secretAccessKey: z.string().min(1, "Enter the secret access key."),
  }),
]);

export async function saveStorage(input: z.input<typeof Connection>): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    requireOwner(ws, "change storage");
    const data = parse(Connection, input);
    const config =
      data.provider === "s3"
        ? { bucket: data.bucket, region: data.region }
        : { bucket: data.bucket, endpoint: data.endpoint };
    const credentials = {
      accessKeyId: data.accessKeyId,
      secretAccessKey: data.secretAccessKey,
    };
    const [existing] = await db
      .select({
        id: storageConnections.id,
        provider: storageProviders.name,
        config: storageConnections.config,
      })
      .from(storageConnections)
      .innerJoin(storageProviders, eq(storageProviders.id, storageConnections.providerId))
      .where(eq(storageConnections.organizationId, ws.id));
    // Re-saving the drive's current bucket (e.g. rotating keys) is fine: it
    // already holds this drive's files.
    const sameBucket =
      existing?.provider === data.provider &&
      existing.config.bucket === config.bucket &&
      (existing.config.endpoint ?? null) === ("endpoint" in config ? config.endpoint : null);
    const target = bucket(data.provider, config, credentials);
    // Never store a connection that doesn't work.
    await target.test().catch(() => {
      throw new DriveError(
        "Couldn't reach that bucket. Check the bucket name, region or endpoint, and the keys."
      );
    });
    if (!sameBucket) {
      const empty = await target.isEmpty().catch(() => {
        throw new DriveError(
          "Couldn't list that bucket's contents. Make sure the keys allow listing objects."
        );
      });
      if (!empty)
        throw new DriveError(
          "That bucket already has files in it. Connect an empty bucket so this drive doesn't mix with other data."
        );
    }
    await db
      .insert(storageProviders)
      .values({ name: data.provider, ...catalog[data.provider] })
      .onConflictDoNothing();
    const [provider] = await db
      .select({ id: storageProviders.id })
      .from(storageProviders)
      .where(eq(storageProviders.name, data.provider));
    const values = {
      providerId: provider.id,
      config,
      // neon-http sends bytea params through String(buffer), which mangles
      // the bytes; let Postgres decode base64 instead.
      credentialsEncrypted: sql`decode(${encryptJson(credentials).toString("base64")}, 'base64')`,
      lastVerifiedAt: new Date(),
    };
    if (existing)
      await db.update(storageConnections).set(values).where(eq(storageConnections.id, existing.id));
    else
      await db
        .insert(storageConnections)
        .values({ ...values, userId: ws.userId, organizationId: ws.id });
  });
}

export async function testStorage(): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    requireOwner(ws, "change storage");
    await (await workspaceBucket(ws.id)).test().catch(() => {
      throw new DriveError("Couldn't reach the bucket. The keys may have been revoked.");
    });
    await db
      .update(storageConnections)
      .set({ lastVerifiedAt: new Date() })
      .where(eq(storageConnections.organizationId, ws.id));
  });
}

export async function disconnectStorage(): Promise<ActionResult> {
  return run(async () => {
    const ws = await requireWorkspace();
    requireOwner(ws, "change storage");
    await db.delete(storageConnections).where(eq(storageConnections.organizationId, ws.id));
  });
}
