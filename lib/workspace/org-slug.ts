import { z } from "zod";

// Organization URLs are /org/<slug>. Personal drives own the `personal-` prefix.
export const OrgSlug = z
  .string()
  .trim()
  .min(2, "Use at least 2 characters.")
  .max(48, "Use no more than 48 characters.")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens.")
  .refine((slug) => !slug.startsWith("personal-"), "That URL is reserved.");

// A URL-safe slug from free text: "Acme Inc." → "acme-inc".
export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 48)
    .replace(/-+$/, "");
}
