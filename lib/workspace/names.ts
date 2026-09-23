import { z } from "zod";

// Names shared by server actions (`parse`) and their forms (input limits).
export const OrgName = z.string().trim().min(2, "Give your organization a name.").max(64);
export const TeamName = z.string().trim().min(2, "Give your team a name.").max(64);
export const DriveName = z
  .string()
  .trim()
  .min(1, "Give your drive a name.")
  .max(64, "Use no more than 64 characters.");
// A file or folder name.
export const ItemName = z
  .string()
  .trim()
  .min(1, "Enter a name.")
  .max(255, "Names can be up to 255 characters.")
  .refine((v) => !/[\x00-\x1f/\\]/.test(v), "Names can't contain / or \\.");

// Ordering file and folder names for display. Names carry numbers people
// count with, and code-unit order reads those digit by digit: "10" lands
// before "2" because "1" < "2", which is never the order the list was named
// in. Numeric collation reads a run of digits as the number it spells.
// One collator, built once, because sorting calls this per comparison.
const collator = new Intl.Collator(undefined, { numeric: true });

export const compareNames = (a: string, b: string) => collator.compare(a, b);
