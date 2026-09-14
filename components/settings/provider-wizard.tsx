"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useQueryStates } from "nuqs";
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
import { useWorkspace } from "@/components/workspace/store";
import { saveStorage } from "@/lib/drive/storage";
import { cn } from "@/lib/utils";
import type { storageProviders } from "@/lib/workspace/providers";
import { credentialCopy, providerQuery, stepHints, steps } from "./provider-config";
import {
  CredentialsStep,
  DoneStep,
  LocationStep,
  ReviewStep,
  StepProgress,
} from "./provider-wizard-steps";
import { providerLogoClass } from "./styles";

// Connect (or edit) a storage provider: credentials, bucket, review, done.
export function ProviderWizard({
  provider,
  editing,
  scope,
  bucket,
  onBucketChange,
  region,
  onRegionChange,
}: {
  provider: (typeof storageProviders)[number] | undefined;
  editing: boolean;
  scope: string;
  bucket: string;
  onBucketChange: (value: string) => void;
  region: string;
  onRegionChange: (value: string) => void;
}) {
  const { drive } = useWorkspace();
  const [query, setQuery] = useQueryStates(providerQuery, { history: "push" });
  const [access, setAccess] = useState("");
  const [secret, setSecret] = useState("");
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const step = Math.min(steps.length, Math.max(1, query.step));
  const copy = credentialCopy[provider?.id ?? "s3"] ?? credentialCopy.s3;
  // R2 is addressed by account endpoint rather than region.
  const endpointMode = provider?.id === "r2";
  function close() {
    void setQuery({ provider: null, step: 1 });
    setAccess("");
    setSecret("");
    setReveal(false);
  }
  return (
    <Dialog
      open={!!provider}
      onOpenChange={(o) => {
        if (!o) close();
      }}
    >
      <DialogContent className="sm:max-w-lg lg:max-w-xl">
        <DialogHeader className="flex-row items-center gap-3 pr-7">
          {provider && (
            <span className={cn(providerLogoClass, "size-10 rounded-[10px]")}>
              <Image
                src={`/icons/${provider.icon}.svg`}
                alt=""
                width={22}
                height={22}
                className="size-[22px]"
              />
            </span>
          )}
          <div className="min-w-0">
            <DialogTitle className="text-[16px] font-semibold">
              {editing ? "Edit" : "Connect"} {provider?.name}
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-[12.5px]">
              {stepHints[step - 1]}
            </DialogDescription>
          </div>
        </DialogHeader>
        <StepProgress step={step} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (step < 3) void setQuery({ step: step + 1 });
            else if (step === 3) {
              if (!provider) return;
              void (async () => {
                setSaving(true);
                const result = await drive.run(
                  saveStorage(
                    provider.id === "r2"
                      ? {
                          provider: "r2",
                          bucket,
                          endpoint: region,
                          accessKeyId: access,
                          secretAccessKey: secret,
                        }
                      : {
                          provider: "s3",
                          bucket,
                          region,
                          accessKeyId: access,
                          secretAccessKey: secret,
                        }
                  )
                );
                setSaving(false);
                if (!result.ok) return;
                setAccess("");
                setSecret("");
                void setQuery({ step: 4 });
              })();
            } else close();
          }}
        >
          {step === 1 ? (
            <CredentialsStep
              copy={copy}
              access={access}
              onAccessChange={setAccess}
              secret={secret}
              onSecretChange={setSecret}
              reveal={reveal}
              onRevealChange={setReveal}
            />
          ) : step === 2 ? (
            <LocationStep
              copy={copy}
              endpointMode={endpointMode}
              bucket={bucket}
              onBucketChange={onBucketChange}
              region={region}
              onRegionChange={onRegionChange}
            />
          ) : step === 3 ? (
            <ReviewStep
              provider={provider}
              scope={scope}
              copy={copy}
              endpointMode={endpointMode}
              access={access}
              bucket={bucket}
              region={region}
            />
          ) : (
            <DoneStep name={provider?.name} scope={scope} bucket={bucket} />
          )}
          <DialogFooter className="mt-6">
            {step > 1 && step < 4 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void setQuery({ step: step - 1 })}
              >
                Back
              </Button>
            )}
            {step === 1 && (
              <Button type="button" variant="ghost" onClick={close}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={saving}>
              {step === 3
                ? saving
                  ? "Checking bucket…"
                  : "Save configuration"
                : step === 4
                  ? "Done"
                  : "Continue"}
              {step < 4 && <ArrowRight />}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
