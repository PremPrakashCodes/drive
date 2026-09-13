import "server-only";

import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  storageConnections,
  storageProviders,
  type StorageConnectionConfig,
} from "@/db/schema";
import { decryptJson } from "@/lib/drive/crypto";
import { DriveError } from "@/lib/drive/workspace";

export type StorageCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
};

export function bucket(
  provider: string,
  config: StorageConnectionConfig,
  credentials: StorageCredentials,
) {
  if (provider !== "s3" && provider !== "r2")
    throw new DriveError(
      "Only Amazon S3 and Cloudflare R2 are supported right now.",
    );
  const client = new S3Client({
    region: provider === "r2" ? "auto" : config.region,
    endpoint: config.endpoint || undefined,
    credentials,
    // R2 rejects the SDK's newer default checksum headers.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const Bucket = config.bucket;
  return {
    uploadUrl: (key: string, contentType: string) =>
      getSignedUrl(
        client,
        new PutObjectCommand({ Bucket, Key: key, ContentType: contentType }),
        { expiresIn: 15 * 60 },
      ),
    downloadUrl: (
      key: string,
      name: string,
      inline = false,
      expiresIn = 5 * 60,
    ) =>
      getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket,
          Key: key,
          ResponseContentDisposition: `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name)}`,
        }),
        { expiresIn },
      ),
    // The first `bytes` of an object as text, for thumbnails.
    peek: async (key: string, bytes: number) => {
      const { Body } = await client.send(
        new GetObjectCommand({ Bucket, Key: key, Range: `bytes=0-${bytes - 1}` }),
      );
      return (await Body?.transformToString("utf-8")) ?? "";
    },
    // The first `bytes` of an object, for sniffing its format.
    peekBytes: async (key: string, bytes: number) => {
      const { Body } = await client.send(
        new GetObjectCommand({ Bucket, Key: key, Range: `bytes=0-${bytes - 1}` }),
      );
      return (await Body?.transformToByteArray()) ?? new Uint8Array();
    },
    head: (key: string) =>
      client.send(new HeadObjectCommand({ Bucket, Key: key })),
    copy: (from: string, to: string) =>
      client.send(
        new CopyObjectCommand({
          Bucket,
          Key: to,
          CopySource: `${Bucket}/${from}`,
        }),
      ),
    remove: async (keys: string[]) => {
      for (let i = 0; i < keys.length; i += 1000)
        await client.send(
          new DeleteObjectsCommand({
            Bucket,
            Delete: {
              Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })),
            },
          }),
        );
    },
    test: () => client.send(new HeadBucketCommand({ Bucket })),
    isEmpty: async () => {
      const { KeyCount } = await client.send(
        new ListObjectsV2Command({ Bucket, MaxKeys: 1 }),
      );
      return !KeyCount;
    },
  };
}

export async function workspaceBucket(organizationId: string) {
  const [row] = await db
    .select({
      provider: storageProviders.name,
      config: storageConnections.config,
      credentials: storageConnections.credentialsEncrypted,
    })
    .from(storageConnections)
    .innerJoin(
      storageProviders,
      eq(storageProviders.id, storageConnections.providerId),
    )
    .where(eq(storageConnections.organizationId, organizationId))
    .limit(1);
  if (!row)
    throw new DriveError(
      "This drive has no storage yet. The owner can connect a bucket in Settings → Storage provider.",
    );
  return bucket(
    row.provider,
    row.config,
    decryptJson<StorageCredentials>(Buffer.from(row.credentials)),
  );
}
