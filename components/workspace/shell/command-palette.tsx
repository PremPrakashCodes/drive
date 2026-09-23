"use client";

import { FileUp, FolderPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PersonAvatar } from "@/components/workspace/common";
import { orgPath, useWorkspaceRoute } from "@/components/workspace/route";
import { useWorkspace } from "@/components/workspace/store";

// ⌘K: search the open drive's files and folders, and (in an org) its teams and organizations.
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data } = useWorkspace();
  const { org, base } = useWorkspaceRoute();
  const router = useRouter();
  // The palette has its own key: `search` belongs to the file browser, so
  // writing to it filtered the list behind the dialog as the person typed and
  // left that filter applied after they dismissed it. A filter, so it
  // replaces; cleared on dismissal, so nothing of it outlives the dialog.
  const [search, setSearch] = useQueryState("command", parseAsString.withDefault(""));
  const [, setPreview] = useQueryState("view", { history: "push" });
  const close = () => {
    void setSearch(null);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="p-0 sm:max-w-xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Search workspace</DialogTitle>
          <DialogDescription>Search files, folders, people, and teams.</DialogDescription>
        </DialogHeader>
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search files, folders, people, teams…"
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {["Files", "Folders"].map((group) => (
              <CommandGroup heading={group} key={group}>
                {data.files
                  .filter(
                    (f) =>
                      !f.trashed &&
                      !f.locked &&
                      (group === "Folders" ? f.kind === "folder" : f.kind !== "folder") &&
                      `${f.name} ${f.owner}`.toLowerCase().includes(search.toLowerCase())
                  )
                  .map((f) => (
                    <CommandItem
                      key={f.id}
                      onSelect={() => {
                        close();
                        if (f.kind === "folder") {
                          router.push(`${base}/drive?folder=${f.id}`);
                        } else {
                          void setPreview(f.id);
                        }
                      }}
                    >
                      <FileUp />
                      <span>{f.name}</span>
                      <small className="ml-auto text-muted-foreground">{f.kind}</small>
                    </CommandItem>
                  ))}
              </CommandGroup>
            ))}
            {org && (
              <>
                <CommandGroup heading="Teams">
                  {data.teams
                    .filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
                    .map((t) => (
                      <CommandItem
                        key={t.id}
                        onSelect={() => {
                          close();
                          router.push(`${base}/teams/${t.id}`);
                        }}
                      >
                        <FolderPlus />
                        {t.name}
                      </CommandItem>
                    ))}
                </CommandGroup>
                <CommandGroup heading="Organizations">
                  {data.organizations
                    .filter((o) => o.name.toLowerCase().includes(search.toLowerCase()))
                    .map((o) => (
                      <CommandItem
                        key={o.id}
                        onSelect={() => {
                          close();
                          router.push(orgPath(o.slug));
                        }}
                      >
                        <PersonAvatar name={o.name} />
                        {o.name}
                      </CommandItem>
                    ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
