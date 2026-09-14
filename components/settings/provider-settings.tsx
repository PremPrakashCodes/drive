"use client";

import { ShieldCheck } from "lucide-react";
import { useQueryStates } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useWorkspaceRoute } from "@/components/workspace/route";
import { useWorkspace } from "@/components/workspace/store";
import { disconnectStorage } from "@/lib/drive/storage";
import { cn } from "@/lib/utils";
import { activeStorage, storageProviders } from "@/lib/workspace/providers";
import { ProviderChoice } from "./provider-choice";
import { credentialCopy, providerQuery } from "./provider-config";
import { ConnectedProvider, WaitingForOwner } from "./provider-current";
import { ProviderWizard } from "./provider-wizard";
import { SettingsHeading } from "./settings-card";
import { demoNoteClass } from "./styles";

export function ProviderSettings() {
  const { drive } = useWorkspace();
  const { org } = useWorkspaceRoute();
  const [query, setQuery] = useQueryStates(providerQuery, { history: "push" });
  const [choice, setChoice] = useState<string>(storageProviders[0].id);
  const [bucket, setBucket] = useState("my-drive");
  const [region, setRegion] = useState("ap-south-1");
  // Kept after closing so the dialog text doesn't blank out while it animates away.
  const [confirm, setConfirm] = useState({
    open: false,
    kind: "disconnect" as "disconnect" | "switch",
    name: "",
  });
  // The connection lives on the server (keys never come back).
  const active = activeStorage(drive.listing?.storage);
  // In a shared drive only the owner manages storage.
  const readOnly = drive.listing?.workspace.role !== "owner";
  const requested = storageProviders.find((p) => p.id === query.provider);
  // Only the connected provider can be reconfigured until it is disconnected.
  const provider =
    requested && (!active || active.provider.id === requested.id) ? requested : undefined;
  const scope = org ? "organization" : "personal workspace";
  function startSetup(id: string, existing?: { bucket: string; region: string }) {
    setBucket(existing?.bucket || "my-drive");
    setRegion(
      existing?.region ||
        (id === "r2" ? "" : (credentialCopy[id] ?? credentialCopy.s3).region.placeholder)
    );
    void setQuery({ provider: id, step: 1 });
  }
  return (
    <>
      <SettingsHeading
        title="Storage provider"
        description={`Every file in this ${scope} is stored in one provider you control.`}
      />
      {active ? (
        <ConnectedProvider
          active={active}
          readOnly={readOnly}
          scope={scope}
          onEdit={() => startSetup(active.provider.id, active)}
          onConfirm={(kind) => setConfirm({ open: true, kind, name: active.provider.name })}
        />
      ) : readOnly ? (
        <WaitingForOwner />
      ) : (
        <ProviderChoice choice={choice} onChoose={setChoice} onStart={startSetup} />
      )}
      <p className={cn(demoNoteClass, "mt-5")}>
        <ShieldCheck className="mt-[3px] size-4 shrink-0" />
        Keys are encrypted on the server and used only to sign uploads and downloads.
      </p>
      <AlertDialog open={confirm.open} onOpenChange={(open) => setConfirm((c) => ({ ...c, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm.kind === "switch"
                ? `Switch away from ${confirm.name}?`
                : `Disconnect ${confirm.name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm.kind === "switch"
                ? `${confirm.name} will be disconnected so you can choose a new provider. Files already stored there stay in that bucket.`
                : `This ${scope} will have no storage provider until you connect one. Files already stored in ${confirm.name} stay in that bucket.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                const previous = active?.provider.id;
                const result = await drive.run(disconnectStorage());
                if (!result.ok) return;
                if (confirm.kind === "switch")
                  setChoice(
                    storageProviders.find((p) => p.id !== previous)?.id ?? storageProviders[0].id
                  );
                setConfirm((c) => ({ ...c, open: false }));
                toast.success(
                  confirm.kind === "switch"
                    ? "Choose your new storage provider"
                    : `${confirm.name} disconnected`
                );
              }}
            >
              {confirm.kind === "switch" ? "Disconnect and switch" : "Disconnect"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ProviderWizard
        provider={provider}
        editing={!!active}
        scope={scope}
        bucket={bucket}
        onBucketChange={setBucket}
        region={region}
        onRegionChange={setRegion}
      />
    </>
  );
}
