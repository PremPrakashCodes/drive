"use client";

import { Lock as LockIcon, Star } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PersonAvatar } from "@/components/workspace/common";
import { formatShortDate } from "@/lib/date";
import { formatSize } from "@/lib/workspace/data";
import { FileIcon } from "../file-visual";
import { FileMenu } from "./file-menu";
import type { FileBrowserState } from "./use-file-browser";

// The list view; the trash always uses it, with its location and deleted date.
export function FileTable({ browser }: { browser: FileBrowserState }) {
  const { files, visible, selected, setSelected, select, open, screen, byId } = browser;
  return (
    <Table className="[&_[data-slot=table-cell]]:h-[54px] [&_[data-slot=table-cell]]:px-2! [&_[data-slot=table-cell]]:py-2.5 [&_[data-slot=table-cell]]:text-[11px] max-md:[&_[data-slot=table-cell]]:h-14 [&_[data-slot=table-head]]:h-9 [&_[data-slot=table-head]]:bg-sidebar [&_[data-slot=table-head]]:px-2! [&_[data-slot=table-head]]:py-2.5 [&_[data-slot=table-head]]:text-[11px] [&_[data-slot=table-head]]:font-normal [&_[data-slot=table-head]]:text-muted-foreground">
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              aria-label="Select all files"
              checked={files.length > 0 && files.every((f) => selected.includes(f.id))}
              onCheckedChange={(checked) => setSelected(checked ? files.map((f) => f.id) : [])}
            />
          </TableHead>
          <TableHead>Name</TableHead>
          <TableHead>{screen === "trash" ? "Original location" : "Type"}</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>{screen === "trash" ? "Deleted" : "Modified"}</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {(screen === "trash" ? files : visible).map((f) => (
          <TableRow
            key={f.id}
            data-state={selected.includes(f.id) ? "selected" : undefined}
            onClick={(e) => select(f, e)}
            onDoubleClick={() => screen !== "trash" && open(f)}
            tabIndex={0}
          >
            <TableCell onClick={(e) => e.stopPropagation()}>
              <Checkbox
                aria-label={`Select ${f.name}`}
                checked={selected.includes(f.id)}
                onCheckedChange={(checked) =>
                  setSelected((ids) => (checked ? [...ids, f.id] : ids.filter((id) => id !== f.id)))
                }
              />
            </TableCell>
            <TableCell>
              <button
                className="flex items-center gap-2.5 text-left text-[12px]"
                onClick={() => screen !== "trash" && open(f)}
              >
                <FileIcon
                  file={f}
                  className="data-[kind=folder]:[&_svg]:h-[22px] data-[kind=folder]:[&_svg]:w-6"
                />
                {f.name}
                {f.starred && <Star className="size-3.5 text-warning" />}
                {f.visibility === "private" && (
                  <LockIcon
                    className="size-3.5 text-muted-foreground"
                    role="img"
                    aria-label="Private"
                  />
                )}
              </button>
            </TableCell>
            <TableCell className="capitalize">
              {screen === "trash" ? (f.parent && byId.get(f.parent)?.name) || "My Drive" : f.kind}
            </TableCell>
            <TableCell>{f.kind === "folder" ? "—" : formatSize(f.size)}</TableCell>
            <TableCell>
              <span className="flex items-center gap-[7px]">
                <PersonAvatar name={f.owner} className="size-[23px]!" />
                {f.owner.split(" ")[0]}
              </span>
            </TableCell>
            <TableCell>
              {formatShortDate((screen === "trash" ? f.deletedAt : undefined) || f.modified)}
            </TableCell>
            <TableCell>
              <FileMenu browser={browser} file={f} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
