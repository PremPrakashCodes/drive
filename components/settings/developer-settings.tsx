"use client";

import type { DeveloperCredential } from "@/types";
import { Plus } from "lucide-react";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";

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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Choice } from "@/components/workspace/common";
import { useWorkspaceRoute } from "@/components/workspace/route";
import { findOrganization, useWorkspace } from "@/components/workspace/store";
import { cn } from "@/lib/utils";
import { CredentialTable } from "./credential-table";
import {
  developerKindIds,
  developerKinds,
  webhookEvents,
  type DeveloperKind,
} from "./developer-kinds";
import { DemoNote } from "./settings-card";
import {
  demoNoteClass,
  sectionDescriptionClass,
  sectionTitleClass,
  tableEmptyClass,
} from "./styles";

// API / Developer and Webhooks: demo credentials saved as a preference.
export function DeveloperSettings({ webhooks = false }: { webhooks?: boolean }) {
  const { data, update } = useWorkspace();
  const { workspace } = useWorkspaceRoute();
  const [tab, setTab] = useQueryState("tab", {
    defaultValue: webhooks ? "webhooks" : "keys",
    history: "push",
  });
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [permission, setPermission] = useState("Read only");
  const key = `${workspace}:developer`;
  const records: DeveloperCredential[] = JSON.parse(String(data.preferences[key] || "[]"));
  const kind: DeveloperKind = tab in developerKinds ? (tab as DeveloperKind) : "keys";
  const current = developerKinds[kind];
  const scopeLabel =
    workspace === "personal"
      ? "Personal workspace"
      : findOrganization(data.organizations, workspace)?.name || workspace;
  const save = (items: DeveloperCredential[]) =>
    update((d) => ({
      ...d,
      preferences: { ...d.preferences, [key]: JSON.stringify(items) },
    }));
  function openCreate() {
    setName("");
    setUrl("");
    setPermission(kind === "webhooks" ? "All file events" : "Read only");
    setModal(true);
  }
  function revoke(credential: DeveloperCredential) {
    const previous = records;
    save(records.filter((x) => x.id !== credential.id));
    toast.success(`${credential.name} revoked`, {
      action: {
        label: "Undo",
        onClick: () => save(previous),
      },
    });
  }
  return (
    <>
      <div className="mb-6.5 flex items-start justify-between gap-4 max-md:flex-col max-md:gap-2.5">
        <div>
          <h2 className={sectionTitleClass}>Built to connect</h2>
          <p className={sectionDescriptionClass}>
            Connect your workspace to the tools and workflows you build.
          </p>
        </div>
        <Badge variant="outline" className="mt-1 shrink-0 gap-1.5">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
          {scopeLabel}
        </Badge>
      </div>
      <Tabs value={kind} onValueChange={(v) => void setTab(String(v))}>
        <TabsList
          variant="line"
          className="h-auto! w-full justify-start gap-5 overflow-x-auto border-b p-0 max-md:gap-3.5"
        >
          {developerKindIds.map((id) => {
            const Icon = developerKinds[id].icon;
            const count = records.filter((r) => r.kind === id).length;
            return (
              <TabsTrigger
                key={id}
                value={id}
                className="h-10 flex-none gap-1.75 px-0.5 py-0 text-[13px] after:-bottom-px!"
              >
                <Icon />
                {developerKinds[id].label}
                {count > 0 && (
                  <span className="inline-grid h-4.5 min-w-4.5 place-items-center rounded-full bg-muted px-1.25 text-[11px] text-muted-foreground tabular-nums">
                    {count}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {developerKindIds.map((id) => {
          const info = developerKinds[id];
          const Icon = info.icon;
          const items = records.filter((r) => r.kind === id);
          return (
            <TabsContent key={id} value={id}>
              <section className="mt-5 overflow-hidden rounded-[14px] border bg-card">
                <header className="flex items-center justify-between gap-4 px-5 py-4.5 max-md:flex-col max-md:items-stretch">
                  <div>
                    <h3 className="flex items-center gap-2 text-[14px] font-semibold">
                      {info.label}
                      <Badge variant="secondary">Demo</Badge>
                    </h3>
                    <p className="mt-0.75 text-[12.5px] text-muted-foreground">
                      {info.description}
                    </p>
                  </div>
                  {items.length > 0 && (
                    <Button onClick={openCreate}>
                      <Plus />
                      Create {info.noun}
                    </Button>
                  )}
                </header>
                {items.length > 0 ? (
                  <CredentialTable
                    items={items}
                    icon={Icon}
                    webhooks={id === "webhooks"}
                    onRevoke={revoke}
                  />
                ) : (
                  <Empty className={tableEmptyClass}>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Icon />
                      </EmptyMedia>
                      <EmptyTitle>{info.emptyTitle}</EmptyTitle>
                      <EmptyDescription>{info.empty}</EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button onClick={openCreate}>
                        <Plus />
                        Create {info.noun}
                      </Button>
                    </EmptyContent>
                  </Empty>
                )}
              </section>
              {id === "webhooks" && (
                <section className="mt-4 rounded-[14px] border px-5 py-4.5">
                  <h3 className="text-[13px] font-medium">Available events</h3>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    Pick any of these when you add an endpoint.
                  </p>
                  <ul className="mt-3.5 flex list-none flex-wrap gap-2 p-0">
                    {webhookEvents.map((e) => (
                      <li key={e}>
                        <code className="inline-block rounded-[7px] border bg-[color-mix(in_srgb,var(--muted)_60%,var(--card))] px-2.25 py-1.25 text-[11.5px]">
                          {e}
                        </code>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <DemoNote className="mt-4">
                Demo records only. No usable credentials are generated and endpoints are never
                called.
              </DemoNote>
            </TabsContent>
          );
        })}
      </Tabs>
      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create {current.singular}</DialogTitle>
            <DialogDescription>
              {current.description} Scoped to {scopeLabel}.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save([
                ...records,
                {
                  id: crypto.randomUUID(),
                  name,
                  date: new Date().toISOString(),
                  permission,
                  kind,
                  url: url || undefined,
                },
              ]);
              setModal(false);
              toast.success(`${name} created`);
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="credential-name">Name</FieldLabel>
                <Input
                  id="credential-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder={kind === "webhooks" ? "Slack notifier" : "My integration"}
                />
              </Field>
              {(kind === "webhooks" || kind === "oauth") && (
                <Field>
                  <FieldLabel htmlFor="credential-url">
                    {kind === "oauth" ? "Redirect URL" : "Endpoint URL"}
                  </FieldLabel>
                  <Input
                    id="credential-url"
                    type="url"
                    pattern="https://.*"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    placeholder="https://example.com/callback"
                  />
                </Field>
              )}
              <Field>
                <FieldLabel>{kind === "webhooks" ? "Events" : "Permissions"}</FieldLabel>
                <Choice
                  label={kind === "webhooks" ? "Events" : "Permissions"}
                  value={permission}
                  onChange={setPermission}
                  options={
                    kind === "webhooks"
                      ? ["All file events", ...webhookEvents]
                      : ["Read only", "Read and write", "Full access"]
                  }
                />
              </Field>
            </FieldGroup>
            <p className={cn(demoNoteClass, "mt-4")}>
              No usable credentials are generated. Connect your backend to issue and manage secrets
              securely.
            </p>
            <DialogFooter className="mt-6">
              <Button type="button" variant="ghost" onClick={() => setModal(false)}>
                Cancel
              </Button>
              <Button type="submit">Create {current.noun}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
