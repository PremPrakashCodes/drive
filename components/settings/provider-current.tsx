"use client";

import { PlugZap, Settings2, Unplug } from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/store";
import { testStorage } from "@/lib/drive/storage";
import { storageProviders, type activeStorage } from "@/lib/workspace/providers";
import {
  providerCurrentClass,
  providerCurrentHeaderClass,
  providerCurrentTitleClass,
  providerDetailClass,
  providerDetailTermClass,
  providerDetailValueClass,
  providerEyebrowClass,
  providerLogoClass,
  providerReadonlyClass,
  statusDotClass,
} from "./styles";

// The connected provider's details, with edit / test / disconnect for the owner.
export function ConnectedProvider({
  active,
  readOnly,
  scope,
  onEdit,
  onConfirm,
}: {
  active: NonNullable<ReturnType<typeof activeStorage>>;
  readOnly: boolean;
  scope: string;
  onEdit: () => void;
  onConfirm: (kind: "disconnect" | "switch") => void;
}) {
  const { drive } = useWorkspace();
  return (
    <>
      <section className={providerCurrentClass} aria-labelledby="provider-current-title">
        <div className={providerCurrentHeaderClass}>
          <span className={providerLogoClass}>
            <Image
              src={`/icons/${active.provider.icon}.svg`}
              alt=""
              width={26}
              height={26}
              className="size-[26px]"
            />
          </span>
          <div className="min-w-0">
            <p className={providerEyebrowClass}>Connected to this {scope}</p>
            <h3 id="provider-current-title" className={providerCurrentTitleClass}>
              {active.provider.name}
            </h3>
          </div>
          <Badge variant="secondary" className="ml-auto gap-1.5">
            <span className={statusDotClass} aria-hidden="true" />
            Connected
          </Badge>
        </div>
        <dl className="grid grid-cols-3 border-t max-md:grid-cols-1">
          <div className={providerDetailClass}>
            <dt className={providerDetailTermClass}>Bucket</dt>
            <dd className={providerDetailValueClass} title={active.bucket}>
              {active.bucket || "—"}
            </dd>
          </div>
          <div className={providerDetailClass}>
            <dt className={providerDetailTermClass}>
              {active.provider.id === "r2" ? "Endpoint" : "Region"}
            </dt>
            <dd className={providerDetailValueClass} title={active.region}>
              {active.region || "—"}
            </dd>
          </div>
          <div className={providerDetailClass}>
            <dt className={providerDetailTermClass}>Status</dt>
            <dd className={providerDetailValueClass}>Verified</dd>
          </div>
        </dl>
        {readOnly ? (
          <p className={providerReadonlyClass}>Storage for this drive is managed by its owner.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5 border-t bg-[color-mix(in_srgb,var(--muted)_60%,var(--card))] px-4 py-3">
            <Button variant="outline" onClick={onEdit}>
              <Settings2 />
              Edit configuration
            </Button>
            <Button
              variant="ghost"
              onClick={() => void drive.run(testStorage(), "Connection works")}
            >
              <PlugZap />
              Test connection
            </Button>
            <Button
              variant="ghost"
              className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive max-md:ml-0 dark:hover:bg-destructive/10"
              onClick={() => onConfirm("disconnect")}
            >
              <Unplug />
              Disconnect
            </Button>
          </div>
        )}
      </section>
      {!readOnly && (
        <section className="mt-4 flex items-center gap-4 rounded-[14px] border border-dashed px-5 py-4 max-md:flex-wrap">
          <div className="min-w-0 flex-1">
            <h3 className="text-[13px] font-medium">Switch provider</h3>
            <p className="mt-0.5 text-[12px] leading-[1.5] text-muted-foreground">
              Only one provider can be connected at a time. Files already in {active.provider.name}{" "}
              won’t move automatically.
            </p>
          </div>
          <div className="flex max-md:hidden" aria-hidden="true">
            {storageProviders
              .filter((p) => p.id !== active.provider.id)
              .map((p) => (
                <Image
                  key={p.id}
                  src={`/icons/${p.icon}.svg`}
                  alt=""
                  width={28}
                  height={28}
                  className="size-[30px] rounded-full border bg-card p-1.5 not-first:-ml-2"
                />
              ))}
          </div>
          <Button variant="outline" onClick={() => onConfirm("switch")}>
            Switch provider
          </Button>
        </section>
      )}
    </>
  );
}

// What members see before the drive owner connects storage.
export function WaitingForOwner() {
  return (
    <section className={providerCurrentClass}>
      <div className={providerCurrentHeaderClass}>
        <div className="min-w-0">
          <p className={providerEyebrowClass}>No storage connected</p>
          <h3 className={providerCurrentTitleClass}>Waiting for the owner</h3>
        </div>
      </div>
      <p className={providerReadonlyClass}>
        The drive owner needs to connect a bucket before anyone can upload.
      </p>
    </section>
  );
}
