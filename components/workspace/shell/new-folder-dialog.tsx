"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useWorkspaceRoute } from "@/components/workspace/route";
import { useWorkspace } from "@/components/workspace/store";
import { createFolder } from "@/lib/drive/items";
import { NewFolderForm } from "@/lib/workspace/form-schemas";

type Values = z.infer<typeof NewFolderForm>;

// Creates a folder in the open folder. "New folder" buttons anywhere in the
// drive open it by dispatching `drive:new-folder`.
export function NewFolderDialog() {
  const { data, drive } = useWorkspace();
  const { page } = useWorkspaceRoute();
  const [folder] = useQueryState("folder", { history: "push" });
  const [open, setOpen] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(NewFolderForm),
    defaultValues: { name: "", private: false },
  });
  const { reset } = form;
  useEffect(() => {
    function newFolder() {
      reset();
      setOpen(true);
    }
    window.addEventListener("drive:new-folder", newFolder);
    return () => window.removeEventListener("drive:new-folder", newFolder);
  }, [reset]);
  const parentPrivate = data.files.find((f) => f.id === folder)?.visibility === "private";
  async function onSubmit(values: Values) {
    const result = await drive.run(
      createFolder({
        name: values.name,
        parentId: folder,
        private: values.private,
        locked: page === "locked",
      }),
      "Folder created"
    );
    if (result.ok) setOpen(false);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
          <DialogDescription>Give your ideas a home.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="new-folder-name">Folder name</FieldLabel>
                  <Input
                    {...field}
                    id="new-folder-name"
                    autoFocus
                    required
                    aria-invalid={fieldState.invalid}
                    placeholder="Untitled folder"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            {/* Everything in the Locked folder is private already. */}
            {page !== "locked" && (
              <Controller
                name="private"
                control={form.control}
                render={({ field }) => (
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldLabel htmlFor="new-folder-private">Private folder</FieldLabel>
                      <FieldDescription>
                        {parentPrivate
                          ? "Everything inside a private folder is private."
                          : "Only you can see it and what's inside."}
                      </FieldDescription>
                    </FieldContent>
                    <Switch
                      id="new-folder-private"
                      checked={field.value || parentPrivate}
                      disabled={parentPrivate}
                      onCheckedChange={field.onChange}
                    />
                  </Field>
                )}
              />
            )}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Create folder
              <ArrowRight />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
