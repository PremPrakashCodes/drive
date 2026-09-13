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
  EMAIL_FROM: z.string().min(1, "Email from address is required").optional().default("Drive <onboarding@resend.dev>"),
});

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
