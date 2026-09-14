"use client";

import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import type { useCreateDialog } from "./use-create-dialog";

// The shell's create dialog: a new folder, or the organization wizard.
export function CreateDialog({ state }: { state: ReturnType<typeof useCreateDialog> }) {
  const {
    page,
    modal,
    setModal,
    name,
    setName,
    privateFolder,
    setPrivateFolder,
    parentPrivate,
    step,
    setStep,
    emails,
    setEmails,
    teamName,
    setTeamName,
    creating,
    slug,
    setCustomSlug,
    slugError,
    setSlugError,
    checkingSlug,
    createFolder,
    createOrganization,
    continueFromName,
  } = state;
  return (
    <Dialog
      open={!!modal}
      onOpenChange={(open) => {
        if (!open) {
          setModal(null);
          setStep(1);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {modal === "folder" ? "New folder" : "A space to work together"}
          </DialogTitle>
          <DialogDescription>
            {modal === "folder"
              ? "Give your ideas a home."
              : `Step ${step} of 3 · Create your organization`}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (modal === "folder") void createFolder();
            else if (step === 1) void continueFromName();
            else if (step < 3) setStep(step + 1);
            else createOrganization();
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="create-name">
                {modal === "folder"
                  ? "Folder name"
                  : step === 1
                    ? "Organization name"
                    : step === 2
                      ? "Team emails (optional)"
                      : "First team name"}
              </FieldLabel>
              <Input
                id="create-name"
                autoFocus
                required={step !== 2}
                value={modal === "folder" || step === 1 ? name : step === 2 ? emails : teamName}
                onChange={(e) =>
                  modal === "folder" || step === 1
                    ? setName(e.target.value)
                    : step === 2
                      ? setEmails(e.target.value)
                      : setTeamName(e.target.value)
                }
                placeholder={
                  modal === "folder"
                    ? "Untitled folder"
                    : step === 1
                      ? "Acme Inc."
                      : step === 2
                        ? "you@example.com"
                        : "Engineering"
                }
              />
              {step === 2 && (
                <small className="text-muted-foreground">
                  You can invite people right after creating the organization.
                </small>
              )}
            </Field>
            {modal === "organization" && step === 1 && (
              <Field data-invalid={slugError ? true : undefined}>
                <FieldLabel htmlFor="create-slug">Organization URL</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>/org/</InputGroupAddon>
                  <InputGroupInput
                    id="create-slug"
                    required
                    value={slug}
                    placeholder="your-organization"
                    aria-invalid={slugError ? true : undefined}
                    onChange={(e) => {
                      setCustomSlug(e.target.value.toLowerCase().replace(/[\s_]+/g, "-"));
                      setSlugError(null);
                    }}
                  />
                </InputGroup>
                {slugError ? (
                  <FieldError>{slugError}</FieldError>
                ) : (
                  <FieldDescription>
                    Lowercase letters, numbers and hyphens. Your organization lives at this link.
                  </FieldDescription>
                )}
              </Field>
            )}
            {/* Everything in the Locked folder is private already. */}
            {modal === "folder" && page !== "locked" && (
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor="create-private">Private folder</FieldLabel>
                  <FieldDescription>
                    {parentPrivate
                      ? "Everything inside a private folder is private."
                      : "Only you can see it and what's inside."}
                  </FieldDescription>
                </FieldContent>
                <Switch
                  id="create-private"
                  checked={privateFolder || parentPrivate}
                  disabled={parentPrivate}
                  onCheckedChange={setPrivateFolder}
                />
              </Field>
            )}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              type="button"
              onClick={() => (step > 1 ? setStep(step - 1) : setModal(null))}
            >
              {step > 1 ? "Back" : "Cancel"}
            </Button>
            <Button type="submit" disabled={checkingSlug || creating}>
              {modal === "folder"
                ? "Create folder"
                : step === 3
                  ? "Create organization"
                  : "Continue"}
              <ArrowRight />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
