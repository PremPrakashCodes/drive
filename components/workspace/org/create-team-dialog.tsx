"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/components/workspace/store";
import { createTeamAction } from "@/lib/drive/teams";
import { TeamName } from "@/lib/workspace/names";
import { Choice } from "../common";

export function CreateTeamButton({ org, reload }: { org: string; reload: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Create team
      </Button>
      <CreateTeamDialog org={org} open={open} onOpenChange={setOpen} reload={reload} />
    </>
  );
}

function CreateTeamDialog({
  org,
  open,
  onOpenChange,
  reload,
}: {
  org: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reload: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("green");
  const [busy, setBusy] = useState(false);
  const { drive } = useWorkspace();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a team</DialogTitle>
          <DialogDescription>Make room for your next collaboration.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            try {
              const result = await drive.run(
                createTeamAction(org, { name, description, color }),
                "Team created",
                reload
              );
              if (!result.ok) return;
              onOpenChange(false);
              setName("");
              setDescription("");
            } finally {
              setBusy(false);
            }
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="team-name">Team name</FieldLabel>
              <Input
                id="team-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={TeamName.minLength ?? undefined}
                placeholder="Engineering"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="team-description">Description</FieldLabel>
              <Textarea
                id="team-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What brings this team together?"
              />
            </Field>
            <Field>
              <FieldLabel>Team color</FieldLabel>
              <Choice
                label="Team color"
                value={color}
                onChange={setColor}
                options={["green", "purple", "amber", "blue"]}
              />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create team"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
