"use client";

import type { StorageCredentialCopy } from "@/types";
import { Check, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import Image from "next/image";

import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import type { storageProviders } from "@/lib/workspace/providers";
import { steps } from "./provider-config";
import {
  credentialInputClass,
  providerLogoClass,
  wizardNoteClass,
  wizardNoteIconClass,
} from "./styles";

// The wizard's progress bar: done, current and upcoming steps.
export function StepProgress({ step }: { step: number }) {
  return (
    <ol className="mt-1 mb-2 flex list-none p-0" aria-label="Setup progress">
      {steps.map((label, i) => {
        const n = i + 1;
        const state = n < step ? "done" : n === step ? "current" : "upcoming";
        return (
          <li
            key={label}
            data-state={state}
            aria-current={n === step ? "step" : undefined}
            className={cn(
              "relative flex min-w-0 flex-1 flex-col items-center gap-1.5",
              i > 0 &&
                "before:absolute before:top-3 before:right-[calc(50%+18px)] before:left-[calc(-50%+18px)] before:h-0.5 before:rounded-xs before:bg-border before:transition-[background-color] before:duration-200 before:ease-[ease] before:content-['']",
              i > 0 && state !== "upcoming" && "before:bg-primary"
            )}
          >
            <span
              className={cn(
                "grid size-6.5 place-items-center rounded-full border-[1.5px] bg-card text-[12px] font-medium text-muted-foreground transition-[background-color,border-color,box-shadow] duration-200 ease-[ease]",
                state === "done" && "border-primary bg-primary text-primary-foreground",
                state === "current" &&
                  "border-primary text-foreground shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_12%,transparent)]"
              )}
            >
              {n < step ? <Check aria-hidden="true" className="size-3.25 stroke-3" /> : n}
            </span>
            <span
              className={cn(
                "max-w-full truncate text-[11px] text-muted-foreground",
                state === "current" ? "font-medium text-foreground" : "max-[480px]:invisible"
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function CredentialsStep({
  copy,
  access,
  onAccessChange,
  secret,
  onSecretChange,
  reveal,
  onRevealChange,
}: {
  copy: StorageCredentialCopy;
  access: string;
  onAccessChange: (value: string) => void;
  secret: string;
  onSecretChange: (value: string) => void;
  reveal: boolean;
  onRevealChange: (reveal: boolean) => void;
}) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="access-key">{copy.access.label}</FieldLabel>
        <Input
          id="access-key"
          className={credentialInputClass}
          autoComplete="off"
          spellCheck={false}
          value={access}
          onChange={(e) => onAccessChange(e.target.value)}
          placeholder={copy.access.placeholder}
          required
        />
        <FieldDescription>{copy.access.hint}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="secret-key">{copy.secret.label}</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id="secret-key"
            className={reveal ? credentialInputClass : undefined}
            autoComplete="off"
            spellCheck={false}
            type={reveal ? "text" : "password"}
            value={secret}
            onChange={(e) => onSecretChange(e.target.value)}
            placeholder={copy.secret.placeholder}
            required
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              aria-label={reveal ? "Hide secret" : "Show secret"}
              aria-pressed={reveal}
              onClick={() => onRevealChange(!reveal)}
            >
              {reveal ? <EyeOff /> : <Eye />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <FieldDescription>{copy.secret.hint}</FieldDescription>
      </Field>
      <p className={wizardNoteClass}>
        <Lock aria-hidden="true" className={wizardNoteIconClass} />
        Keys are encrypted before they&apos;re saved and never shown again.
      </p>
    </FieldGroup>
  );
}

export function LocationStep({
  copy,
  endpointMode,
  bucket,
  onBucketChange,
  region,
  onRegionChange,
}: {
  copy: StorageCredentialCopy;
  endpointMode: boolean;
  bucket: string;
  onBucketChange: (value: string) => void;
  region: string;
  onRegionChange: (value: string) => void;
}) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="bucket">{copy.bucket.label}</FieldLabel>
        <Input
          id="bucket"
          className={credentialInputClass}
          spellCheck={false}
          required
          value={bucket}
          placeholder={copy.bucket.placeholder}
          onChange={(e) => onBucketChange(e.target.value)}
        />
        <FieldDescription>{copy.bucket.hint}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="region">
          {endpointMode ? "Account endpoint" : copy.region.label}
        </FieldLabel>
        <Input
          id="region"
          className={credentialInputClass}
          type={endpointMode ? "url" : "text"}
          spellCheck={false}
          required
          value={region}
          placeholder={
            endpointMode ? "https://<account-id>.r2.cloudflarestorage.com" : copy.region.placeholder
          }
          onChange={(e) => onRegionChange(e.target.value)}
        />
        <FieldDescription>
          {endpointMode
            ? "R2 → Overview → S3 API. Leave the bucket name off the end."
            : copy.region.hint}
        </FieldDescription>
      </Field>
    </FieldGroup>
  );
}

export function ReviewStep({
  provider,
  scope,
  copy,
  endpointMode,
  access,
  bucket,
  region,
}: {
  provider: (typeof storageProviders)[number] | undefined;
  scope: string;
  copy: StorageCredentialCopy;
  endpointMode: boolean;
  access: string;
  bucket: string;
  region: string;
}) {
  return (
    <>
      <div className="overflow-hidden rounded-[12px] border">
        <div className="flex items-center gap-3 border-b bg-[color-mix(in_srgb,var(--muted)_60%,var(--card))] px-4 py-3.5">
          {provider && (
            <span className={cn(providerLogoClass, "size-9 rounded-[9px]")}>
              <Image
                src={`/icons/${provider.icon}.svg`}
                alt=""
                width={20}
                height={20}
                className="size-5"
              />
            </span>
          )}
          <div className="min-w-0">
            <strong className="block text-[13.5px] font-medium">{provider?.name}</strong>
            <small className="text-[11.5px] text-muted-foreground">Storage for this {scope}</small>
          </div>
        </div>
        <dl className="flex flex-col gap-3 px-4 py-3.5 text-[12.5px]">
          <div className="flex justify-between gap-5">
            <dt className="text-muted-foreground">{copy.access.label}</dt>
            <dd className="text-right font-mono text-[12.5px] wrap-break-word">
              {access.slice(0, 4)}
              {"•".repeat(Math.max(4, Math.min(12, access.length - 4)))}
            </dd>
          </div>
          <div className="flex justify-between gap-5">
            <dt className="text-muted-foreground">{copy.bucket.label}</dt>
            <dd className="text-right font-mono text-[12.5px] wrap-break-word">{bucket}</dd>
          </div>
          <div className="flex justify-between gap-5">
            <dt className="text-muted-foreground">
              {endpointMode ? "Endpoint" : copy.region.label}
            </dt>
            <dd className="text-right font-mono text-[12.5px] wrap-break-word">{region}</dd>
          </div>
        </dl>
      </div>
      <p className={wizardNoteClass}>
        <ShieldCheck aria-hidden="true" className={wizardNoteIconClass} />
        Saving checks that the bucket can be reached with these keys.
      </p>
    </>
  );
}

export function DoneStep({
  name,
  scope,
  bucket,
}: {
  name: string | undefined;
  scope: string;
  bucket: string;
}) {
  return (
    <div className="flex flex-col items-center px-2 pt-3 pb-1 text-center">
      <span className="mb-3.5 grid size-13 place-items-center rounded-full bg-[#16a34a]/12 text-[#16a34a]">
        <Check aria-hidden="true" className="size-6.5 stroke-[2.5]" />
      </span>
      <h3 className="text-[17px] font-semibold">{name} is ready</h3>
      <p className="mt-1.5 max-w-[320px] text-[12.5px] leading-[1.6] text-muted-foreground">
        Files in this {scope} will be stored in{" "}
        <strong className="font-medium text-foreground">{bucket}</strong>. Allow PUT requests from
        this site in the bucket&apos;s CORS rules so browsers can upload.
      </p>
    </div>
  );
}
