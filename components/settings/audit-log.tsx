"use client";

import { ScrollText, Search } from "lucide-react";
import { useQueryState } from "nuqs";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Choice, PersonAvatar } from "@/components/workspace/common";
import { useWorkspace } from "@/components/workspace/store";
import { compareByDate, formatDateTime } from "@/lib/date";
import { cn } from "@/lib/utils";
import { DemoNote, SettingsHeading } from "./settings-card";
import {
  cardClass,
  tableCellClass,
  tableEmptyClass,
  tableHeadClass,
  tableWrapperClass,
} from "./styles";

// A readable action name for the audit log, derived from a file's state.
function auditAction(file: { kind: string; trashed?: boolean; locked?: boolean }) {
  if (file.trashed) return "file.trashed";
  if (file.locked) return "file.locked";
  return file.kind === "folder" ? "folder.created" : "file.uploaded";
}

export function AuditLog() {
  const { data } = useWorkspace();
  const [search, setSearch] = useQueryState("search", { defaultValue: "" });
  const [action, setAction] = useQueryState("action", { defaultValue: "all" });
  // Real audit trail derived from the drive: what changed and who owns it.
  const events = data.files
    .filter(
      (f) =>
        (action === "all" || action === auditAction(f)) &&
        f.name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => compareByDate(b.modified, a.modified))
    .slice(0, 50)
    .map((f) => ({
      id: f.id,
      user: f.owner,
      action: auditAction(f),
      resource: f.name,
      date: f.modified,
    }));
  return (
    <>
      <SettingsHeading
        title="Workspace audit log"
        description="A clear record of what happened, and when."
      />
      <section className={cardClass}>
        <div className="flex items-center gap-2 px-4 py-3.5 max-md:flex-wrap">
          <InputGroup className="w-[260px] max-md:w-full">
            <InputGroupInput
              value={search}
              onChange={(e) => void setSearch(e.target.value)}
              placeholder="Search resources…"
              aria-label="Search audit log"
            />
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
          </InputGroup>
          <Choice
            label="Audit action"
            className="w-44"
            value={action}
            onChange={setAction}
            options={[
              { label: "All actions", value: "all" },
              ...Array.from(new Set(data.files.map((f) => auditAction(f)))).map((a) => ({
                label: a,
                value: a,
              })),
            ]}
          />
          <span className="ml-auto text-[12px] text-muted-foreground tabular-nums">
            {events.length} {events.length === 1 ? "event" : "events"}
          </span>
        </div>
        {events.length > 0 ? (
          <div className={tableWrapperClass}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={tableHeadClass}>User</TableHead>
                  <TableHead className={tableHeadClass}>Action</TableHead>
                  <TableHead className={tableHeadClass}>Resource</TableHead>
                  <TableHead className={tableHeadClass}>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className={tableCellClass}>
                      <span className="flex min-w-0 items-center gap-2.5">
                        <PersonAvatar name={e.user} />
                        <strong className="block font-medium">{e.user}</strong>
                      </span>
                    </TableCell>
                    <TableCell className={tableCellClass}>
                      <Badge variant="outline" className="font-mono">
                        {e.action}
                      </Badge>
                    </TableCell>
                    <TableCell className={tableCellClass}>{e.resource}</TableCell>
                    <TableCell className={cn(tableCellClass, "text-muted-foreground")}>
                      <time dateTime={e.date}>{formatDateTime(e.date)}</time>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Empty className={tableEmptyClass}>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ScrollText />
              </EmptyMedia>
              <EmptyTitle>No matching events</EmptyTitle>
              <EmptyDescription>Try a different resource name or action.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="outline"
                onClick={() => {
                  void setSearch(null);
                  void setAction(null);
                }}
              >
                Clear filters
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </section>
      <DemoNote className="mt-4">
        Local demonstration events. Production audit logging requires a backend.
      </DemoNote>
    </>
  );
}
