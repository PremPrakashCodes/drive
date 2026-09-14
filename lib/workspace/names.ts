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
