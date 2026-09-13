"use client";

import type { DriveFile } from "@/lib/workspace/data";
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
import { storageProviders } from "@/lib/workspace/providers";
import { GrowthChart } from "./growth-chart";
import { useWorkspaceRoute } from "./route";
import { useWorkspace } from "./store";

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
  const connection = drive.listing?.storage;
  const active = drive.active
    ? connection?.connected
      ? {
          provider:
            storageProviders.find((p) => p.id === connection.provider) ?? storageProviders[0],
          bucket: connection.bucket,
          region: connection.region ?? connection.endpoint ?? "",
        }
      : null
    : null;
  // Donut + legend from the workspace's real per-kind totals.
  const byKind = (stats?.byKind ?? []).slice(0, 4);
  const totalForDonut = byKind.reduce((sum, k) => sum + k.size, 0);
  const kindColor = ["green", "purple", "amber", "blue"];
  const kindLabel: Record<string, string> = {
    video: "Videos",
    image: "Images",
    pdf: "Documents",
    document: "Documents",
    spreadsheet: "Spreadsheets",
    audio: "Audio",
    archive: "Archives",
    code: "Code",
  };
  // Where the bytes live: top-level folders by subtree size.
  const folders = useMemo(() => {
    const byId = new Map(data.files.filter((f) => !f.trashed).map((f) => [f.id, f]));
    const sizeOf = (id: string, seen = new Set<string>()): number => {
      const file = byId.get(id);
      if (!file || seen.has(id)) return 0;
      seen.add(id);
      if (file.kind === "folder")
        return data.files
          .filter((f) => f.parent === id && !f.trashed && f.kind !== "folder")
          .reduce((sum, f) => sum + f.size, 0);
      return file.size;
    };
    const roots = new Map<string, number>();
    for (const file of data.files) {
      if (file.trashed || file.kind === "folder") continue;
      const root = file.parent ? ancestor(byId, file.parent) : null;
      const key = root ? root.name : "My Drive";
      roots.set(key, (roots.get(key) ?? 0) + file.size);
    }
    void sizeOf;
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
      <div className="page-heading">
        <div>
          <h1>
            Room to grow<span className="heading-dot">.</span>
          </h1>
          <p>Your storage, at a glance. A place for everything that matters.</p>
        </div>
        <Button variant="outline" onClick={() => router.push(`${base}/settings?section=storage`)}>
          Manage provider
          <ArrowUpRight />
        </Button>
      </div>
      <div className="metric-grid storage-metrics">
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
          <Card key={m.label}>
            <CardHeader>
              <CardDescription className="flex justify-between">
                {m.label}
                <m.icon className="size-4" />
              </CardDescription>
              <CardTitle className="metric-value">{m.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{m.caption}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="analytics-grid">
        <Card>
          <CardHeader>
            <CardTitle>Storage by file type</CardTitle>
            <CardDescription>
              {byKind.length ? "What your workspace holds." : "Upload files to see the split."}
            </CardDescription>
          </CardHeader>
          <CardContent className="donut-layout">
            <div
              className="storage-donut"
              role="img"
              aria-label={
                byKind.length
                  ? byKind
                      .map(
                        (k) =>
                          `${kindLabel[k.kind] ?? k.kind} ${totalForDonut ? Math.round((k.size / totalForDonut) * 100) : 0}%`
                      )
                      .join(", ")
                  : "No files yet"
              }
            >
              <div>
                <strong>{formatSize(usedBytes).split(" ")[0]}</strong>
                <span>{formatSize(usedBytes).split(" ")[1] ?? "B"} used</span>
              </div>
            </div>
            <div className="chart-legend">
              {byKind.map((k, i) => (
                <div key={k.kind}>
                  <i className={kindColor[i % kindColor.length]} />
                  <span>{kindLabel[k.kind] ?? k.kind}</span>
                  <strong>{formatSize(k.size)}</strong>
                </div>
              ))}
              {!byKind.length && <div className="text-sm text-muted-foreground">Nothing stored yet.</div>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Growing with your ideas</CardTitle>
            <CardDescription>Storage usage over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <GrowthChart usedBytes={usedBytes} />
          </CardContent>
        </Card>
      </div>
      <div className="analytics-grid">
        <Card>
          <CardHeader>
            <CardTitle>Storage provider</CardTitle>
            <CardDescription>One provider holds every file in this workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            {active ? (
              <>
                <div className="flex items-center gap-3">
                  <Image src={`/icons/${active.provider.icon}.svg`} alt="" width={21} height={21} />
                  <strong className="font-medium">{active.provider.name}</strong>
                </div>
                <dl className="info-list mt-5">
                  <div>
                    <dt>Used</dt>
                    <dd>{formatSize(usedBytes)}</dd>
                  </div>
                  <div>
                    <dt>Bucket</dt>
                    <dd>{active.bucket}</dd>
                  </div>
                  <div>
                    <dt>Region</dt>
                    <dd>{active.region}</dd>
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
        <Card>
          <CardHeader>
            <CardTitle>{workspace === "personal" ? "Storage by folder" : "Workspace usage"}</CardTitle>
            <CardDescription>Where your work lives.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="usage-list">
              {folders.map((entry) => (
                <div key={entry.name}>
                  <span>{entry.name}</span>
                  <strong>{formatSize(entry.size)}</strong>
                  <Progress value={entry.progress} />
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
        <div className="section-heading">
          <h2>Largest files</h2>
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
                    className="table-file-name"
                    onClick={() => router.push(`${base}/drive?preview=${f.id}`)}
                  >
                    <FileIcon file={f} />
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
