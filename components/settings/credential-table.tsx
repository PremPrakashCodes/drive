"use client";

import type { DeveloperCredential } from "@/types";
import type { LucideIcon } from "lucide-react";
import { Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMediumDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import { tableCellClass, tableHeadClass, tableWrapperClass } from "./styles";

// One kind of developer credential, each row revocable.
export function CredentialTable({
  items,
  icon: Icon,
  webhooks,
  onRevoke,
}: {
  items: DeveloperCredential[];
  icon: LucideIcon;
  webhooks: boolean;
  onRevoke: (credential: DeveloperCredential) => void;
}) {
  return (
    <div className={tableWrapperClass}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={tableHeadClass}>Name</TableHead>
            <TableHead className={tableHeadClass}>{webhooks ? "Events" : "Permissions"}</TableHead>
            <TableHead className={tableHeadClass}>Created</TableHead>
            <TableHead className={tableHeadClass}>Status</TableHead>
            <TableHead className={tableHeadClass}>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((r) => (
            <TableRow key={r.id}>
              <TableCell className={tableCellClass}>
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-7.5 shrink-0 place-items-center rounded-[8px] bg-muted text-muted-foreground [&_svg]:size-3.75">
                    <Icon />
                  </span>
                  <span className="min-w-0">
                    <strong className="block font-medium">{r.name}</strong>
                    {r.url && (
                      <small
                        title={r.url}
                        className="block max-w-70 truncate font-mono text-[11.5px] text-muted-foreground"
                      >
                        {r.url}
                      </small>
                    )}
                  </span>
                </span>
              </TableCell>
              <TableCell className={tableCellClass}>
                <Badge variant="outline">{r.permission}</Badge>
              </TableCell>
              <TableCell className={tableCellClass}>{formatMediumDate(r.date)}</TableCell>
              <TableCell className={tableCellClass}>
                <Badge variant="secondary">Demo</Badge>
              </TableCell>
              <TableCell className={cn(tableCellClass, "text-right")}>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Revoke ${r.name}`}
                  title="Revoke"
                  onClick={() => onRevoke(r)}
                >
                  <Trash2 />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
