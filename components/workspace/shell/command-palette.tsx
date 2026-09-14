"use client";

import { FileUp, FolderPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";

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
  const [search, setSearch] = useQueryState("search", { defaultValue: "" });
  const [, setPreview] = useQueryState("preview", { history: "push" });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                        onOpenChange(false);
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
                          onOpenChange(false);
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
                          onOpenChange(false);
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
