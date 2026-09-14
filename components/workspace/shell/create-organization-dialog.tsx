"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { orgPath } from "@/components/workspace/route";
import { useWorkspace } from "@/components/workspace/store";
import { splitEmails } from "@/lib/auth-form";
import { switchSpace } from "@/lib/drive/items";
import { checkOrganizationSlug, createOrganizationAction, inviteMembers } from "@/lib/drive/org";
import { CreateOrganizationForm } from "@/lib/workspace/form-schemas";
import { slugify } from "@/lib/workspace/org-slug";

type Values = z.infer<typeof CreateOrganizationForm>;

// The text field each step shows; step 1 also shows the organization URL.
const stepFields = [
  { name: "name", label: "Organization name", placeholder: "Acme Inc." },
  { name: "emails", label: "Team emails (optional)", placeholder: "you@example.com" },
  { name: "teamName", label: "First team name", placeholder: "Engineering" },
] as const;

// The three-step organization wizard: name + URL, team emails, first team.
// The shell remounts it (new `key`) on every open, so each run starts fresh.
export function CreateOrganizationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { drive } = useWorkspace();
  const router = useRouter();
  const [step, setStep] = useState(1);
  // The organization's URL follows its name until the user edits it.
  const [slugEdited, setSlugEdited] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(CreateOrganizationForm),
    defaultValues: { name: "", slug: "", emails: "", teamName: "Engineering" },
  });
  const current = stepFields[step - 1];
  // Each submit validates the form and advances a step; the last one creates.
  async function onSubmit(values: Values) {
    if (step === 1) {
      // Step 1 → 2 only with an organization URL that's still free.
      const result = await checkOrganizationSlug(values.slug);
      if (!result.ok) form.setError("slug", { message: result.error });
      else if (!result.data)
        form.setError("slug", { message: "That URL is already taken. Choose another." });
      else setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }
    const result = await createOrganizationAction({
      name: values.name,
      slug: values.slug,
      teamName: values.teamName,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    // Open the new organization's drive (switch the server-side space).
    if (result.data.id !== drive.listing?.workspace.id) await switchSpace(result.data.id);
    // The wizard's optional team emails become real invitations.
    if (splitEmails(values.emails).length)
      await inviteMembers(result.data.slug, { emails: values.emails, role: "member" });
    await drive.reload();
    onOpenChange(false);
    router.push(orgPath(result.data.slug));
    toast.success("Organization created");
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>A space to work together</DialogTitle>
          <DialogDescription>{`Step ${step} of 3 · Create your organization`}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              key={current.name}
              name={current.name}
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="org-wizard-field">{current.label}</FieldLabel>
                  <Input
                    {...field}
                    id="org-wizard-field"
                    autoFocus
                    required={step !== 2}
                    aria-invalid={fieldState.invalid}
                    placeholder={current.placeholder}
                    onChange={(e) => {
                      field.onChange(e);
                      if (current.name === "name" && !slugEdited)
                        form.setValue("slug", slugify(e.target.value));
                    }}
                  />
                  {step === 2 && (
                    <small className="text-muted-foreground">
                      You can invite people right after creating the organization.
                    </small>
                  )}
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            {step === 1 && (
              <Controller
                name="slug"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="org-wizard-slug">Organization URL</FieldLabel>
                    <InputGroup>
                      <InputGroupAddon>/org/</InputGroupAddon>
                      <InputGroupInput
                        {...field}
                        id="org-wizard-slug"
                        required
                        placeholder="your-organization"
                        aria-invalid={fieldState.invalid}
                        onChange={(e) => {
                          setSlugEdited(true);
                          field.onChange(e.target.value.toLowerCase().replace(/[\s_]+/g, "-"));
                        }}
                      />
                    </InputGroup>
                    {fieldState.invalid ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : (
                      <FieldDescription>
                        Lowercase letters, numbers and hyphens. Your organization lives at this
                        link.
                      </FieldDescription>
                    )}
                  </Field>
                )}
              />
            )}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              type="button"
              onClick={() => (step > 1 ? setStep(step - 1) : onOpenChange(false))}
            >
              {step > 1 ? "Back" : "Cancel"}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {step === 3 ? "Create organization" : "Continue"}
              <ArrowRight />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
