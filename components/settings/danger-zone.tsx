"use client";

import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useWorkspaceRoute } from "@/components/workspace/route";
import { useWorkspace } from "@/components/workspace/store";
import { deleteItems } from "@/lib/drive/items";
import { DeleteOrganization } from "./delete-organization";
import { SettingsCard, SettingsHeading } from "./settings-card";
import { rowDescriptionClass, rowTitleClass } from "./styles";

export function DangerZone() {
  const { data, drive } = useWorkspace();
  const { org } = useWorkspaceRoute();
  return (
    <>
      <SettingsHeading title="Danger zone" description="Changes here need a little extra care." />
      <SettingsCard className="border-[color-mix(in_srgb,var(--destructive)_35%,var(--border))]">
        <div className="flex items-center gap-3.5 px-5 py-[18px] max-md:flex-col max-md:items-start max-md:gap-3 max-md:px-4">
          <span
            className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-destructive/10 text-destructive max-md:hidden [&_svg]:size-4"
            aria-hidden="true"
          >
            <RotateCcw />
          </span>
          <div className="min-w-0 flex-1">
            <strong className={rowTitleClass}>Empty the trash</strong>
            <p className={rowDescriptionClass}>
              Permanently delete everything currently in this workspace&apos;s trash.
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => {
              const trashed = data.files.filter((f) => f.trashed);
              if (!trashed.length) {
                toast.info("The trash is already empty");
                return;
              }
              void drive.run(deleteItems(trashed.map((f) => f.id)), "Trash emptied");
            }}
          >
            Empty trash
          </Button>
        </div>
        {org && <DeleteOrganization org={org} />}
      </SettingsCard>
    </>
  );
}
