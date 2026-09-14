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
