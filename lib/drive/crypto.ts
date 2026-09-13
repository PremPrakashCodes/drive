import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { env } from "@/env";

// AES-256-GCM. Stored layout: 12-byte IV | 16-byte auth tag | ciphertext.
function key() {
  if (!env.STORAGE_ENCRYPTION_KEY)
    throw new Error(
      "STORAGE_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` and add it to .env.local."
    );
  return Buffer.from(env.STORAGE_ENCRYPTION_KEY, "base64");
}

export function encryptJson(value: unknown): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

export function decryptJson<T>(payload: Buffer): T {
  const decipher = createDecipheriv("aes-256-gcm", key(), payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  const text = Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString(
    "utf8"
  );
  return JSON.parse(text) as T;
}
