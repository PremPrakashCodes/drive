"use client";

import type { DriveFile } from "@/types";
import { ArrowUpRight, Database, Files, HardDrive } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { FileIcon } from "@/components/files/file-visual";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatShortDate } from "@/lib/date";
import { formatSize } from "@/lib/workspace/data";
import { activeStorage } from "@/lib/workspace/providers";
import { GrowthChart } from "./growth-chart";
import { useWorkspaceRoute } from "./route";
import { StorageTypeChart } from "./storage-type-chart";
import { useWorkspace } from "./store";

const flatCard = "shadow-none ring-0";
const analyticsGrid = "mt-5.5 grid grid-cols-[1fr_1fr] gap-5 max-md:grid-cols-[1fr]";
const analyticsTitle = "text-[14px] leading-snug";

// Walk up to the top-level folder a file lives under.
function ancestor(byId: Map<string, DriveFile>, id: string): DriveFile | null {
  const file = byId.get(id);
  if (!file) return null;
  if (!file.parent) return file;
  return ancestor(byId, file.parent) ?? file;
}

export function StoragePage() {
  const router = useRouter();
  const { base, workspace } = useWorkspaceRoute();
  const { data, drive } = useWorkspace();
  const stats = drive.listing?.storageStats;
  const usedBytes = stats?.usedBytes ?? 0;
  const largest = data.files
    .filter((f) => !f.trashed && f.kind !== "folder")
    .sort((a, b) => b.size - a.size)
    .slice(0, 5);
  const active = activeStorage(drive.listing?.storage);
  // Where the bytes live: top-level folders by subtree size.
  const folders = useMemo(() => {
    const byId = new Map(data.files.filter((f) => !f.trashed).map((f) => [f.id, f]));
    const roots = new Map<string, number>();
    for (const file of data.files) {
      if (file.trashed || file.kind === "folder") continue;
      const root = file.parent ? ancestor(byId, file.parent) : null;
      const key = root ? root.name : "My Drive";
      roots.set(key, (roots.get(key) ?? 0) + file.size);
    }
    return Array.from(roots.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, size]) => ({
        name,
        size,
        progress: usedBytes ? Math.round((size / usedBytes) * 100) : 0,
      }));
  }, [data.files, usedBytes]);
  return (
    <>
      <div className="mb-7.25 flex items-center justify-between gap-6 max-md:mb-5.75 max-md:items-start max-md:gap-3">
        <div>
          <h1 className="text-[29px] leading-[1.3] font-[550] tracking-[-1.2px] max-md:text-[27px]">
            Room to grow<span className="text-folder-green">.</span>
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground max-md:max-w-60 max-md:text-[11px] max-md:leading-[1.6]">
            Your storage, at a glance. A place for everything that matters.
          </p>
        </div>
        <Button
          variant="outline"
          className="h-8.75 gap-1.75 px-3.25 text-[11px]"
          onClick={() => router.push(`${base}/settings?section=storage`)}
        >
          Manage provider
          <ArrowUpRight />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-4 max-[1000px]:grid-cols-[repeat(2,1fr)]">
        {[
          {
            label: "Used storage",
            value: formatSize(usedBytes),
            caption: active ? `Stored in ${active.provider.name}` : "Stored in this workspace",
            icon: HardDrive,
          },
          {
            label: "Storage provider",
            value: active?.provider.name ?? "Not connected",
            caption: active ? `Bucket · ${active.bucket}` : "Connect a provider in settings",
            icon: Database,
          },
          {
            label: "Files",
            value: String(stats?.fileCount ?? 0),
            caption: "Stored in this workspace",
            icon: Files,
          },
        ].map((m) => (
          <Card key={m.label} className={flatCard}>
            <CardHeader>
              <CardDescription className="flex justify-between text-[11px]">
                {m.label}
                <m.icon className="size-4" />
              </CardDescription>
              <CardTitle className="mt-2.25 text-[29px] leading-snug font-medium tracking-[-1px]">
                {m.value}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{m.caption}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className={analyticsGrid}>
        <Card className={flatCard}>
          <CardHeader>
            <CardTitle className={analyticsTitle}>Storage by file type</CardTitle>
            <CardDescription className="text-[11px]">
              {stats?.byKind.length
                ? "What your workspace holds."
                : "Upload files to see the split."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 items-center pb-7.5">
            <StorageTypeChart byKind={stats?.byKind ?? []} usedBytes={usedBytes} />
          </CardContent>
        </Card>
        <Card className={flatCard}>
          <CardHeader>
            <CardTitle className={analyticsTitle}>Growing with your ideas</CardTitle>
            <CardDescription className="text-[11px]">
              Storage usage over the last 6 months
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GrowthChart history={stats?.byMonth ?? []} />
          </CardContent>
        </Card>
      </div>
      <div className={analyticsGrid}>
        <Card className={flatCard}>
          <CardHeader>
            <CardTitle className={analyticsTitle}>Storage provider</CardTitle>
            <CardDescription className="text-[11px]">
              One provider holds every file in this workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {active ? (
              <>
                <div className="flex items-center gap-3">
                  <Image src={`/icons/${active.provider.icon}.svg`} alt="" width={21} height={21} />
                  <strong className="font-medium">{active.provider.name}</strong>
                </div>
                <dl className="mt-5 flex flex-col gap-4 text-[12px]">
                  <div className="flex justify-between gap-5">
                    <dt className="text-muted-foreground">Used</dt>
                    <dd className="text-right wrap-break-word">{formatSize(usedBytes)}</dd>
                  </div>
                  <div className="flex justify-between gap-5">
                    <dt className="text-muted-foreground">Bucket</dt>
                    <dd className="text-right wrap-break-word">{active.bucket}</dd>
                  </div>
                  <div className="flex justify-between gap-5">
                    <dt className="text-muted-foreground">Region</dt>
                    <dd className="text-right wrap-break-word">{active.region}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <div className="flex flex-col items-start gap-4">
                <p className="text-sm text-muted-foreground">
                  No provider is connected to this workspace yet.
                </p>
                <Button
                  variant="outline"
                  onClick={() => router.push(`${base}/settings?section=storage`)}
                >
                  Connect provider
                  <ArrowUpRight />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className={flatCard}>
          <CardHeader>
            <CardTitle className={analyticsTitle}>
              {workspace === "personal" ? "Storage by folder" : "Workspace usage"}
            </CardTitle>
            <CardDescription className="text-[11px]">Where your work lives.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-5.25">
              {folders.map((entry) => (
                <div key={entry.name} className="flex flex-wrap items-center gap-2.25 text-[11px]">
                  <span>{entry.name}</span>
                  <strong className="ml-auto font-medium">{formatSize(entry.size)}</strong>
                  <Progress value={entry.progress} className="h-1 w-full" />
                </div>
              ))}
              {!folders.length && (
                <p className="text-sm text-muted-foreground">No files stored yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2.25 text-[13px] font-[550] md:text-[14px]">
            Largest files
          </h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Modified</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {largest.map((f) => (
              <TableRow key={f.id}>
                <TableCell>
                  <button
                    className="flex items-center gap-2.5 text-left text-[12px]"
                    onClick={() => router.push(`${base}/drive?view=${f.id}`)}
                  >
                    <FileIcon
                      file={f}
                      className="data-[kind=folder]:[&_svg]:h-5.5 data-[kind=folder]:[&_svg]:w-6"
                    />
                    {f.name}
                  </button>
                </TableCell>
                <TableCell>{formatSize(f.size)}</TableCell>
                <TableCell>
                  {data.files.find((x) => x.id === f.parent)?.name || "My Drive"}
                </TableCell>
                <TableCell>{formatShortDate(f.modified)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </>
  );
}
