import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z
    .url({
      protocol: /^postgres(ql)?$/,
      error: (issue) =>
        issue.input === undefined
          ? "Database URL is required"
          : "Expected a postgresql:// connection string",
    })
    .optional(),
  // Signs sessions, verification links and reset tokens. Without it every auth
  // form fails with a generic error and nothing says why, so it is required and
  // long enough to be a real key (`openssl rand -base64 32`).
  BETTER_AUTH_SECRET: z.string().min(32, "Expected at least 32 characters"),
  // The app's own origin. Better Auth builds callback and invitation links from
  // it, so a wrong or missing value sends people somewhere that isn't the app.
  BETTER_AUTH_URL: z.url({
    protocol: /^https?$/,
    error: (issue) =>
      issue.input === undefined ? "Base URL is required" : "Expected an http:// or https:// origin",
  }),
  RESEND_API_KEY: z.string().min(1, "Resend API key is required"),
  EMAIL_FROM: z
    .string()
    .min(1, "Email from address is required")
    .optional()
    .default("Drive <onboarding@resend.dev>"),
  // 32 random bytes, base64 (`openssl rand -base64 32`). Encrypts storage
  // provider credentials. Optional so the app boots before storage is set up.
  STORAGE_ENCRYPTION_KEY: z
    .base64("Expected a base64 string")
    .refine((v) => Buffer.from(v, "base64").length === 32, "Expected 32 bytes")
    .optional(),
  // Vercel Cron sends it as a Bearer token. Cron routes reject every request
  // while it's unset.
  CRON_SECRET: z.string().min(16, "Expected at least 16 characters").optional(),
  // How many bytes one drive may keep in its bucket. There are no per-drive
  // allowances, so this single default is what stops a member writing
  // unbounded data into the owner's storage.
  STORAGE_QUOTA_BYTES: z.coerce
    .number()
    .int("Expected a whole number of bytes")
    .positive("Expected a positive number of bytes")
    .optional()
    .default(100 * 1000 ** 3),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

const parsed = serverEnvSchema.safeParse(process.env);

if (!parsed.success) {
  const errors = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  console.error("❌ Invalid environment variables. Fix the following in .env.local:\n" + errors);

  throw new Error("Invalid environment variables");
}

export const env: Readonly<ServerEnv> = parsed.data;
