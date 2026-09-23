import { z } from "zod";

export const emailSchema = z.string().trim().email("Enter a valid email address.").max(254);
// The display name, bounded so it stays a name — it is rendered in member
// lists and interpolated into outbound email.
export const nameSchema = z.string().trim().min(2, "Enter at least 2 characters.").max(100);
// A free-text address list ("a@x.com, b@y.com; c@z.com") as separate entries.
export const splitEmails = (text: string) => text.split(/[;,\s]+/).filter(Boolean);
const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Use no more than 128 characters.");
export const authSchemas = {
  "sign-in": z.object({
    email: emailSchema,
    password: z.string().min(1, "Enter your password.").max(128),
  }),
  "sign-up": z.object({
    name: nameSchema,
    email: emailSchema,
    password,
  }),
  "forgot-password": z.object({ email: emailSchema }),
  "reset-password": z
    .object({ password, confirmPassword: z.string(), token: z.string().min(1) })
    .refine((data) => data.password === data.confirmPassword, {
      path: ["confirmPassword"],
      message: "Passwords do not match.",
    }),
};

// Only permit local destinations, excluding authentication routes to avoid loops.
export function safeRedirect(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\x00-\x20]/.test(value)
  )
    return "/";
  try {
    const url = new URL(value, "https://drive.local");
    if (
      url.origin !== "https://drive.local" ||
      /^\/(sign-in|sign-up|forgot-password|reset-password|verify-email|api)(\/|$)/.test(
        decodeURIComponent(url.pathname)
      )
    )
      return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}
