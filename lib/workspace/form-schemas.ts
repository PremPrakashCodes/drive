import { z } from "zod";

import { emailSchema, splitEmails } from "@/lib/auth-form";
import { ItemName, OrgName, TeamName } from "@/lib/workspace/names";
import { OrgSlug } from "@/lib/workspace/org-slug";

// Schemas for the shell's create dialogs (zodResolver on the client). The
// server actions re-validate every field with these same rules.
export const NewFolderForm = z.object({ name: ItemName, private: z.boolean() });

export const CreateOrganizationForm = z.object({
  name: OrgName,
  slug: OrgSlug,
  // Optional free text; the wizard turns each address into an invitation.
  emails: z.string().refine((text) => {
    const list = splitEmails(text);
    return list.length <= 20 && list.every((email) => emailSchema.safeParse(email).success);
  }, "Enter up to 20 valid email addresses."),
  teamName: TeamName,
});
