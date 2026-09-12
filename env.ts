import { z } from "zod";

const credentials = {
  STORAGE_ACCESS_KEY_ID: z.string().min(1, "Access key id is required"),
  STORAGE_SECRET_ACCESS_KEY: z
    .string()
    .min(1, "Secret access key is required"),
};

const shared = {
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: (issue) =>
      issue.input === undefined
        ? "Database URL is required"
        : "Expected a postgresql:// connection string",
  }),
  STORAGE_BUCKET: z.string().min(1, "Bucket name is required"),
  ...credentials,
};

const s3Env = z.object({
  ...shared,
  STORAGE_PROVIDER: z.literal("S3"),
  STORAGE_REGION: z.string().min(1, "Region is required for S3"),
  STORAGE_ENDPOINT: z.url().optional(),
});

const r2Env = z.object({
  ...shared,
  STORAGE_PROVIDER: z.literal("R2"),
  STORAGE_REGION: z.string().default("auto"),
  STORAGE_ENDPOINT: z
    .url()
    .refine(
      (url) => new URL(url).hostname.endsWith(".r2.cloudflarestorage.com"),
      "Expected an R2 endpoint like https://<account-id>.r2.cloudflarestorage.com",
    ),
});

const gcsEnv = z.object({
  ...shared,
  STORAGE_PROVIDER: z.literal("GCS"),
  STORAGE_REGION: z.string().optional(),
  STORAGE_ENDPOINT: z.url(),
});

const azureEnv = z.object({
  ...shared,
  STORAGE_PROVIDER: z.literal("AZURE"),
  STORAGE_REGION: z.string().optional(),
  STORAGE_ENDPOINT: z.url(),
});

const serverEnvSchema = z.discriminatedUnion("STORAGE_PROVIDER", [
  s3Env,
  r2Env,
  gcsEnv,
  azureEnv,
]);

export type ServerEnv = z.infer<typeof serverEnvSchema>;

const parsed = serverEnvSchema.safeParse(process.env);

if (!parsed.success) {
  const errors = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  console.error(
    "❌ Invalid environment variables. Fix the following in .env.local:\n" +
      errors,
  );

  throw new Error("Invalid environment variables");
}

export const env: Readonly<ServerEnv> = parsed.data;