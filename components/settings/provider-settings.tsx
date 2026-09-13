"use client";
import Image from "next/image";
import { useState } from "react";
import { parseAsInteger, useQueryStates, parseAsString } from "nuqs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useWorkspace } from "@/components/workspace/store";
import { useWorkspaceRoute } from "@/components/workspace/route";
import {
  storageProviders,
  getActiveProvider,
  connectProvider,
  disconnectProvider,
} from "@/lib/workspace/providers";
import {
  Check,
  ShieldCheck,
  ArrowRight,
  Eye,
  EyeOff,
  Settings2,
  PlugZap,
  Unplug,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import {
  disconnectStorage,
  saveStorage,
  testStorage,
} from "@/lib/drive/storage";
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
export function ProviderSettings() {
  const { data, update, drive } = useWorkspace();
  const { workspace, org } = useWorkspaceRoute();
  const [query, setQuery] = useQueryStates(
    { provider: parseAsString, step: parseAsInteger.withDefault(1) },
    { history: "push" },
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
            storageProviders.find((p) => p.id === connection.provider) ??
            storageProviders[0],
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
    requested && (!active || active.provider.id === requested.id)
      ? requested
      : undefined;
  const step = Math.min(steps.length, Math.max(1, query.step));
  const scope = org ? "organization" : "personal workspace";
  const chosen =
    storageProviders.find((p) => p.id === choice) ?? storageProviders[0];
  const copy = credentialCopy[provider?.id ?? "s3"] ?? credentialCopy.s3;
  // R2 is addressed by account endpoint rather than region.
  const endpointMode = remote && provider?.id === "r2";
  function startSetup(
    id: string,
    existing?: { bucket: string; region: string },
  ) {
    setBucket(existing?.bucket || "my-drive");
    setRegion(
      existing?.region ||
        (remote && id === "r2"
          ? ""
          : (credentialCopy[id] ?? credentialCopy.s3).region.placeholder),
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
      <div className="settings-section-heading">
        <h2>Storage provider</h2>
        <p>Every file in this {scope} is stored in one provider you control.</p>
      </div>
      {active ? (
        <>
          <section
            className="provider-current"
            aria-labelledby="provider-current-title"
          >
            <div className="provider-current-header">
              <span className="provider-logo">
                <Image
                  src={`/icons/${active.provider.icon}.svg`}
                  alt=""
                  width={26}
                  height={26}
                />
              </span>
              <div className="min-w-0">
                <p className="provider-eyebrow">Connected to this {scope}</p>
                <h3 id="provider-current-title">{active.provider.name}</h3>
              </div>
              <Badge variant="secondary" className="provider-status">
                <span className="provider-status-dot" aria-hidden="true" />
                {remote ? "Connected" : "Demo configured"}
              </Badge>
            </div>
            <dl className="provider-details">
              <div>
                <dt>Bucket</dt>
                <dd title={active.bucket}>{active.bucket || "—"}</dd>
              </div>
              <div>
                <dt>
                  {remote && active.provider.id === "r2"
                    ? "Endpoint"
                    : "Region"}
                </dt>
                <dd title={active.region}>{active.region || "—"}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{remote ? "Verified" : "Awaiting backend connection"}</dd>
              </div>
            </dl>
            {readOnly ? (
              <p className="provider-readonly">
                Storage for this drive is managed by its owner.
              </p>
            ) : (
              <div className="provider-current-actions">
                <Button
                  variant="outline"
                  onClick={() => startSetup(active.provider.id, active)}
                >
                  <Settings2 />
                  Edit configuration
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    remote
                      ? void drive.run(testStorage(), "Connection works")
                      : toast.info(
                          "Connection testing requires a backend. Credentials have not been sent.",
                        )
                  }
                >
                  <PlugZap />
                  Test connection
                </Button>
                <Button
                  variant="ghost"
                  className="provider-disconnect"
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
            <section className="provider-switch">
              <div>
                <h3>Switch provider</h3>
                <p>
                  Only one provider can be connected at a time. Files already in{" "}
                  {active.provider.name} won’t move automatically.
                </p>
              </div>
              <div className="provider-switch-logos" aria-hidden="true">
                {storageProviders
                  .filter((p) => p.id !== active.provider.id)
                  .map((p) => (
                    <Image
                      key={p.id}
                      src={`/icons/${p.icon}.svg`}
                      alt=""
                      width={28}
                      height={28}
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
        <section className="provider-current">
          <div className="provider-current-header">
            <div className="min-w-0">
              <p className="provider-eyebrow">No storage connected</p>
              <h3>Waiting for the owner</h3>
            </div>
          </div>
          <p className="provider-readonly">
            The drive owner needs to connect a bucket before anyone can upload.
          </p>
        </section>
      ) : (
        <section className="provider-picker">
          <div
            role="radiogroup"
            aria-label="Storage provider"
            className="provider-options"
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
                  className="provider-option"
                  disabled={!supported(p.id)}
                  onClick={() => setChoice(p.id)}
                  onDoubleClick={() => startSetup(p.id)}
                >
                  <span className="provider-logo">
                    <Image
                      src={`/icons/${p.icon}.svg`}
                      alt=""
                      width={26}
                      height={26}
                    />
                  </span>
                  <span className="provider-option-text">
                    <strong>{p.name}</strong>
                    <small>
                      {supported(p.id) ? p.description : "Coming soon"}
                    </small>
                  </span>
                  <span className="provider-radio" aria-hidden="true">
                    <Check />
                  </span>
                </button>
              );
            })}
          </div>
          <div className="provider-picker-footer">
            <p>You can switch later by disconnecting this provider.</p>
            <Button onClick={() => startSetup(chosen.id)}>
              Continue with {chosen.name}
              <ArrowRight />
            </Button>
          </div>
        </section>
      )}
      <p className="demo-note mt-5">
        <ShieldCheck className="size-4" />
        {remote
          ? "Keys are encrypted on the server and used only to sign uploads and downloads."
          : "Credentials are never saved by this UI demo. Connect a backend before using real secrets."}
      </p>
      <AlertDialog
        open={confirm.open}
        onOpenChange={(open) => setConfirm((c) => ({ ...c, open }))}
      >
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
                    storageProviders.find((p) => p.id !== previous)?.id ??
                      storageProviders[0].id,
                  );
                setConfirm((c) => ({ ...c, open: false }));
                toast.success(
                  confirm.kind === "switch"
                    ? "Choose your new storage provider"
                    : `${confirm.name} disconnected`,
                );
              }}
            >
              {confirm.kind === "switch"
                ? "Disconnect and switch"
                : "Disconnect"}
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
        <DialogContent className="provider-wizard sm:max-w-lg lg:max-w-xl">
          <DialogHeader className="provider-wizard-header">
            {provider && (
              <span className="provider-logo">
                <Image
                  src={`/icons/${provider.icon}.svg`}
                  alt=""
                  width={22}
                  height={22}
                />
              </span>
            )}
            <div className="min-w-0">
              <DialogTitle>
                {active ? "Edit" : "Connect"} {provider?.name}
              </DialogTitle>
              <DialogDescription>{stepHints[step - 1]}</DialogDescription>
            </div>
          </DialogHeader>
          <ol className="wizard-steps" aria-label="Setup progress">
            {steps.map((label, i) => {
              const n = i + 1;
              return (
                <li
                  key={label}
                  data-state={
                    n < step ? "done" : n === step ? "current" : "upcoming"
                  }
                  aria-current={n === step ? "step" : undefined}
                >
                  <span className="wizard-step-dot">
                    {n < step ? <Check aria-hidden="true" /> : n}
                  </span>
                  <span className="wizard-step-label">{label}</span>
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
                            },
                      ),
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
                  <FieldLabel htmlFor="access-key">
                    {copy.access.label}
                  </FieldLabel>
                  <Input
                    id="access-key"
                    className="credential-input"
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
                  <FieldLabel htmlFor="secret-key">
                    {copy.secret.label}
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="secret-key"
                      className={reveal ? "credential-input" : undefined}
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
                <p className="wizard-note">
                  <Lock aria-hidden="true" />
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
                    className="credential-input"
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
                    className="credential-input"
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
                <div className="wizard-review">
                  <div className="wizard-review-provider">
                    {provider && (
                      <span className="provider-logo">
                        <Image
                          src={`/icons/${provider.icon}.svg`}
                          alt=""
                          width={20}
                          height={20}
                        />
                      </span>
                    )}
                    <div className="min-w-0">
                      <strong>{provider?.name}</strong>
                      <small>Storage for this {scope}</small>
                    </div>
                  </div>
                  <dl className="info-list">
                    <div>
                      <dt>{copy.access.label}</dt>
                      <dd className="credential-input">
                        {access.slice(0, 4)}
                        {"•".repeat(
                          Math.max(4, Math.min(12, access.length - 4)),
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>{copy.bucket.label}</dt>
                      <dd className="credential-input">{bucket}</dd>
                    </div>
                    <div>
                      <dt>{endpointMode ? "Endpoint" : copy.region.label}</dt>
                      <dd className="credential-input">{region}</dd>
                    </div>
                  </dl>
                </div>
                <p className="wizard-note">
                  <ShieldCheck aria-hidden="true" />
                  {remote
                    ? "Saving checks that the bucket can be reached with these keys."
                    : "This demo can’t validate credentials or bucket permissions."}
                </p>
              </>
            ) : (
              <div className="wizard-complete">
                <span className="wizard-complete-icon">
                  <Check aria-hidden="true" />
                </span>
                <h3>{provider?.name} is ready</h3>
                <p>
                  Files in this {scope} will be stored in{" "}
                  <strong>{bucket}</strong>.{" "}
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
