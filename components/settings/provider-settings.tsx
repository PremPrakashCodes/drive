"use client";

import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Lock,
  PlugZap,
  Settings2,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import Image from "next/image";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useWorkspaceRoute } from "@/components/workspace/route";
import { useWorkspace } from "@/components/workspace/store";
import { disconnectStorage, saveStorage, testStorage } from "@/lib/drive/storage";
import { cn } from "@/lib/utils";
import {
  connectProvider,
  disconnectProvider,
  getActiveProvider,
  storageProviders,
} from "@/lib/workspace/providers";

const steps = ["Credentials", "Bucket & region", "Review", "Done"];
const stepHints = [
  "Add the keys this workspace will use.",
  "Choose where files should live.",
  "Check the details before saving.",
  "Your storage provider is ready.",
];
type FieldCopy = { label: string; placeholder: string; hint: string };
const credentialCopy: Record<
  string,
  { access: FieldCopy; secret: FieldCopy; bucket: FieldCopy; region: FieldCopy }
> = {
  s3: {
    access: {
      label: "Access key ID",
      placeholder: "AKIAIOSFODNN7EXAMPLE",
      hint: "Create one in IAM → Users → Security credentials.",
    },
    secret: {
      label: "Secret access key",
      placeholder: "Paste your secret access key",
      hint: "Shown once when the access key is created.",
    },
    bucket: {
      label: "Bucket",
      placeholder: "my-drive-files",
      hint: "An existing S3 bucket this workspace can read and write.",
    },
    region: {
      label: "Region",
      placeholder: "ap-south-1",
      hint: "The AWS region the bucket was created in.",
    },
  },
  r2: {
    access: {
      label: "Access key ID",
      placeholder: "e.g. 3f1c0e8a9b…",
      hint: "Create an R2 API token under R2 → Manage API tokens.",
    },
    secret: {
      label: "Secret access key",
      placeholder: "Paste your R2 secret",
      hint: "Shown once when the API token is created.",
    },
    bucket: {
      label: "Bucket",
      placeholder: "my-drive-files",
      hint: "An existing R2 bucket in your Cloudflare account.",
    },
    region: {
      label: "Region",
      placeholder: "auto",
      hint: "Most R2 buckets use auto.",
    },
  },
  gcs: {
    access: {
      label: "Service account email",
      placeholder: "drive@project.iam.gserviceaccount.com",
      hint: "The service account with Storage Object Admin access.",
    },
    secret: {
      label: "Service account key",
      placeholder: "Paste the private key from the JSON file",
      hint: "Download it from IAM → Service accounts → Keys.",
    },
    bucket: {
      label: "Bucket",
      placeholder: "my-drive-files",
      hint: "An existing Cloud Storage bucket.",
    },
    region: {
      label: "Location",
      placeholder: "asia-south1",
      hint: "The bucket's location in Google Cloud.",
    },
  },
  azure: {
    access: {
      label: "Storage account name",
      placeholder: "mydrivestorage",
      hint: "Found on the storage account's overview page.",
    },
    secret: {
      label: "Account key",
      placeholder: "Paste key1 or key2",
      hint: "Security + networking → Access keys.",
    },
    bucket: {
      label: "Container",
      placeholder: "my-drive-files",
      hint: "An existing blob container in this storage account.",
    },
    region: {
      label: "Region",
      placeholder: "centralindia",
      hint: "The Azure region of the storage account.",
    },
  },
};

// Shared settings styles (kept identical across components/settings/*).
const sectionTitleClass = "text-[19px] font-medium tracking-[-0.4px]";
const sectionDescriptionClass = "mt-2 text-[12px] leading-[1.7] text-muted-foreground";
const demoNoteClass = "flex items-start gap-[7px] text-[11px] leading-[1.7] text-muted-foreground";
const statusDotClass = "size-1.5 rounded-full bg-[#16a34a]";
// Storage provider styles.
const providerLogoClass = "grid size-11 shrink-0 place-items-center rounded-[11px] border bg-card";
const providerCurrentClass = "overflow-hidden rounded-[14px] border bg-card";
const providerCurrentHeaderClass = "flex items-center gap-3.5 p-5 max-md:flex-wrap";
const providerEyebrowClass = "text-[11px] text-muted-foreground";
const providerCurrentTitleClass = "mt-0.5 text-[17px] font-semibold";
const providerDetailClass =
  "min-w-0 px-5 py-3.5 not-first:border-l max-md:not-first:border-t max-md:not-first:border-l-0";
const providerDetailTermClass = "text-[11px] text-muted-foreground";
const providerDetailValueClass = "mt-1 truncate text-[13px] font-medium";
const providerReadonlyClass = "border-t px-5 py-3.5 text-[12.5px] text-muted-foreground";
const credentialInputClass = "font-mono text-[12.5px] md:text-[12.5px]";
const wizardNoteClass =
  "mt-3 flex items-start gap-2 text-[12px] leading-[1.5] text-muted-foreground";
const wizardNoteIconClass = "mt-0.5 size-3.5 shrink-0";

export function ProviderSettings() {
  const { data, update, drive } = useWorkspace();
  const { workspace, org } = useWorkspaceRoute();
  const [query, setQuery] = useQueryStates(
    { provider: parseAsString, step: parseAsInteger.withDefault(1) },
    { history: "push" }
  );
  const [choice, setChoice] = useState<string>(storageProviders[0].id);
  const [bucket, setBucket] = useState("my-drive");
  const [region, setRegion] = useState("ap-south-1");
  const [access, setAccess] = useState("");
  const [secret, setSecret] = useState("");
  const [reveal, setReveal] = useState(false);
  // Kept after closing so the dialog text doesn't blank out while it animates away.
  const [confirm, setConfirm] = useState({
    open: false,
    kind: "disconnect" as "disconnect" | "switch",
    name: "",
  });
  // Signed in: the connection lives on the server (keys never come back).
  const remote = drive.active;
  const connection = drive.listing?.storage;
  const active = remote
    ? connection?.connected
      ? {
          provider:
            storageProviders.find((p) => p.id === connection.provider) ?? storageProviders[0],
          bucket: connection.bucket,
          region: connection.region ?? connection.endpoint ?? "",
        }
      : null
    : getActiveProvider(data.preferences, workspace);
  // In a shared drive only the owner manages storage.
  const readOnly = remote && drive.listing?.workspace.role !== "owner";
  const supported = (id: string) => !remote || id === "s3" || id === "r2";
  const [saving, setSaving] = useState(false);
  const requested = storageProviders.find((p) => p.id === query.provider);
  // Only the connected provider can be reconfigured until it is disconnected.
  const provider =
    requested && (!active || active.provider.id === requested.id) ? requested : undefined;
  const step = Math.min(steps.length, Math.max(1, query.step));
  const scope = org ? "organization" : "personal workspace";
  const chosen = storageProviders.find((p) => p.id === choice) ?? storageProviders[0];
  const copy = credentialCopy[provider?.id ?? "s3"] ?? credentialCopy.s3;
  // R2 is addressed by account endpoint rather than region.
  const endpointMode = remote && provider?.id === "r2";
  function startSetup(id: string, existing?: { bucket: string; region: string }) {
    setBucket(existing?.bucket || "my-drive");
    setRegion(
      existing?.region ||
        (remote && id === "r2" ? "" : (credentialCopy[id] ?? credentialCopy.s3).region.placeholder)
    );
    void setQuery({ provider: id, step: 1 });
  }
  function close() {
    void setQuery({ provider: null, step: 1 });
    setAccess("");
    setSecret("");
    setReveal(false);
  }
  return (
    <>
      <div className="mb-[26px]">
        <h2 className={sectionTitleClass}>Storage provider</h2>
        <p className={sectionDescriptionClass}>
          Every file in this {scope} is stored in one provider you control.
        </p>
      </div>
      {active ? (
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
                {remote ? "Connected" : "Demo configured"}
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
                  {remote && active.provider.id === "r2" ? "Endpoint" : "Region"}
                </dt>
                <dd className={providerDetailValueClass} title={active.region}>
                  {active.region || "—"}
                </dd>
              </div>
              <div className={providerDetailClass}>
                <dt className={providerDetailTermClass}>Status</dt>
                <dd className={providerDetailValueClass}>
                  {remote ? "Verified" : "Awaiting backend connection"}
                </dd>
              </div>
            </dl>
            {readOnly ? (
              <p className={providerReadonlyClass}>
                Storage for this drive is managed by its owner.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5 border-t bg-[color-mix(in_srgb,var(--muted)_60%,var(--card))] px-4 py-3">
                <Button variant="outline" onClick={() => startSetup(active.provider.id, active)}>
                  <Settings2 />
                  Edit configuration
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    remote
                      ? void drive.run(testStorage(), "Connection works")
                      : toast.info(
                          "Connection testing requires a backend. Credentials have not been sent."
                        )
                  }
                >
                  <PlugZap />
                  Test connection
                </Button>
                <Button
                  variant="ghost"
                  className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive max-md:ml-0 dark:hover:bg-destructive/10"
                  onClick={() =>
                    setConfirm({
                      open: true,
                      kind: "disconnect",
                      name: active.provider.name,
                    })
                  }
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
                  Only one provider can be connected at a time. Files already in{" "}
                  {active.provider.name} won’t move automatically.
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
              <Button
                variant="outline"
                onClick={() =>
                  setConfirm({
                    open: true,
                    kind: "switch",
                    name: active.provider.name,
                  })
                }
              >
                Switch provider
              </Button>
            </section>
          )}
        </>
      ) : readOnly ? (
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
      ) : (
        <section>
          <div
            role="radiogroup"
            aria-label="Storage provider"
            className="grid grid-cols-2 gap-3 max-md:grid-cols-1"
          >
            {storageProviders.map((p) => {
              const checked = p.id === choice;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  data-checked={checked || undefined}
                  className="group/option flex items-center gap-3.5 rounded-[12px] border bg-card p-4 text-left transition-[border-color,box-shadow,background-color] duration-150 ease-[ease] hover:border-[color-mix(in_srgb,var(--foreground)_22%,var(--border))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-checked:border-primary data-checked:bg-accent data-checked:shadow-[0_0_0_1px_var(--primary)]"
                  disabled={!supported(p.id)}
                  onClick={() => setChoice(p.id)}
                  onDoubleClick={() => startSetup(p.id)}
                >
                  <span className={providerLogoClass}>
                    <Image
                      src={`/icons/${p.icon}.svg`}
                      alt=""
                      width={26}
                      height={26}
                      className="size-[26px]"
                    />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <strong className="text-[14px] font-medium">{p.name}</strong>
                    <small className="text-[12px] leading-[1.4] text-muted-foreground">
                      {supported(p.id) ? p.description : "Coming soon"}
                    </small>
                  </span>
                  <span
                    className="grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] border-input text-transparent transition-[background-color,border-color] duration-150 ease-[ease] group-data-checked/option:border-primary group-data-checked/option:bg-primary group-data-checked/option:text-primary-foreground"
                    aria-hidden="true"
                  >
                    <Check className="size-3 stroke-3" />
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex items-center justify-between gap-4 border-t pt-5 max-md:flex-col max-md:items-stretch">
            <p className="text-[12px] text-muted-foreground">
              You can switch later by disconnecting this provider.
            </p>
            <Button onClick={() => startSetup(chosen.id)}>
              Continue with {chosen.name}
              <ArrowRight />
            </Button>
          </div>
        </section>
      )}
      <p className={cn(demoNoteClass, "mt-5")}>
        <ShieldCheck className="mt-[3px] size-4 shrink-0" />
        {remote
          ? "Keys are encrypted on the server and used only to sign uploads and downloads."
          : "Credentials are never saved by this UI demo. Connect a backend before using real secrets."}
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
                if (remote) {
                  const result = await drive.run(disconnectStorage());
                  if (!result.ok) return;
                } else
                  update((d) => ({
                    ...d,
                    preferences: disconnectProvider(d.preferences, workspace),
                  }));
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
                {active ? "Edit" : "Connect"} {provider?.name}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-[12.5px]">
                {stepHints[step - 1]}
              </DialogDescription>
            </div>
          </DialogHeader>
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
                      "before:absolute before:top-3 before:right-[calc(50%+18px)] before:left-[calc(-50%+18px)] before:h-0.5 before:rounded-[2px] before:bg-border before:transition-[background-color] before:duration-200 before:ease-[ease] before:content-['']",
                    i > 0 && state !== "upcoming" && "before:bg-primary"
                  )}
                >
                  <span
                    className={cn(
                      "grid size-[26px] place-items-center rounded-full border-[1.5px] bg-card text-[12px] font-medium text-muted-foreground transition-[background-color,border-color,box-shadow] duration-200 ease-[ease]",
                      state === "done" && "border-primary bg-primary text-primary-foreground",
                      state === "current" &&
                        "border-primary text-foreground shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_12%,transparent)]"
                    )}
                  >
                    {n < step ? <Check aria-hidden="true" className="size-[13px] stroke-3" /> : n}
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (step < 3) void setQuery({ step: step + 1 });
              else if (step === 3) {
                if (!provider) return;
                if (remote) {
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
                  return;
                }
                update((d) => ({
                  ...d,
                  preferences: connectProvider(d.preferences, workspace, {
                    provider: provider.id,
                    bucket,
                    region,
                  }),
                }));
                setAccess("");
                setSecret("");
                void setQuery({ step: 4 });
              } else close();
            }}
          >
            {step === 1 ? (
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="access-key">{copy.access.label}</FieldLabel>
                  <Input
                    id="access-key"
                    className={credentialInputClass}
                    autoComplete="off"
                    spellCheck={false}
                    value={access}
                    onChange={(e) => setAccess(e.target.value)}
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
                      onChange={(e) => setSecret(e.target.value)}
                      placeholder={copy.secret.placeholder}
                      required
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        size="icon-xs"
                        aria-label={reveal ? "Hide secret" : "Show secret"}
                        aria-pressed={reveal}
                        onClick={() => setReveal(!reveal)}
                      >
                        {reveal ? <EyeOff /> : <Eye />}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldDescription>{copy.secret.hint}</FieldDescription>
                </Field>
                <p className={wizardNoteClass}>
                  <Lock aria-hidden="true" className={wizardNoteIconClass} />
                  {remote
                    ? "Keys are encrypted before they're saved and never shown again."
                    : "Keys are cleared after saving. This demo never stores them."}
                </p>
              </FieldGroup>
            ) : step === 2 ? (
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
                    onChange={(e) => setBucket(e.target.value)}
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
                      endpointMode
                        ? "https://<account-id>.r2.cloudflarestorage.com"
                        : copy.region.placeholder
                    }
                    onChange={(e) => setRegion(e.target.value)}
                  />
                  <FieldDescription>
                    {endpointMode
                      ? "R2 → Overview → S3 API. Leave the bucket name off the end."
                      : copy.region.hint}
                  </FieldDescription>
                </Field>
              </FieldGroup>
            ) : step === 3 ? (
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
                      <small className="text-[11.5px] text-muted-foreground">
                        Storage for this {scope}
                      </small>
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
                      <dd className="text-right font-mono text-[12.5px] wrap-break-word">
                        {bucket}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-5">
                      <dt className="text-muted-foreground">
                        {endpointMode ? "Endpoint" : copy.region.label}
                      </dt>
                      <dd className="text-right font-mono text-[12.5px] wrap-break-word">
                        {region}
                      </dd>
                    </div>
                  </dl>
                </div>
                <p className={wizardNoteClass}>
                  <ShieldCheck aria-hidden="true" className={wizardNoteIconClass} />
                  {remote
                    ? "Saving checks that the bucket can be reached with these keys."
                    : "This demo can’t validate credentials or bucket permissions."}
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center px-2 pt-3 pb-1 text-center">
                <span className="mb-3.5 grid size-[52px] place-items-center rounded-full bg-[#16a34a]/12 text-[#16a34a]">
                  <Check aria-hidden="true" className="size-[26px] stroke-[2.5]" />
                </span>
                <h3 className="text-[17px] font-semibold">{provider?.name} is ready</h3>
                <p className="mt-1.5 max-w-[320px] text-[12.5px] leading-[1.6] text-muted-foreground">
                  Files in this {scope} will be stored in{" "}
                  <strong className="font-medium text-foreground">{bucket}</strong>.{" "}
                  {remote
                    ? "Allow PUT requests from this site in the bucket's CORS rules so browsers can upload."
                    : "Connect a backend to start syncing."}
                </p>
              </div>
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
    </>
  );
}
