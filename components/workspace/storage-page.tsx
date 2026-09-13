"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useWorkspaceRoute } from "./route";
import { useWorkspace } from "./store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Database, ArrowUpRight, HardDrive, Files } from "lucide-react";
import { FileIcon } from "@/components/files/file-visual";
import { formatSize } from "@/lib/workspace/data";
import {
  getActiveProvider,
  storageProviders,
} from "@/lib/workspace/providers";
import { GrowthChart } from "./growth-chart";
export function StoragePage() {
  const router = useRouter();
  const { base, workspace } = useWorkspaceRoute();
  const { data, drive } = useWorkspace();
  const largest = data.files
    .filter(
      (f) => f.workspace === workspace && !f.trashed && f.kind !== "folder",
    )
    .sort((a, b) => b.size - a.size)
    .slice(0, 5);
  const connection = drive.listing?.storage;
  const active = drive.active
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
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            Room to grow<span className="heading-dot">.</span>
          </h1>
          <p>Your storage, at a glance. A place for everything that matters.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push(`${base}/settings?section=storage`)}
        >
          Manage provider
          <ArrowUpRight />
        </Button>
      </div>
      <p className="demo-note mb-5">
        Sample storage analytics · connect your backend for live usage
      </p>
      <div className="metric-grid storage-metrics">
        {[
          {
            label: "Used storage",
            value: "824 GB",
            caption: active
              ? `Stored in ${active.provider.name}`
              : "Stored in this workspace",
            icon: HardDrive,
          },
          {
            label: "Storage provider",
            value: active?.provider.name ?? "Not connected",
            caption: active
              ? `Bucket · ${active.bucket}`
              : "Connect a provider in settings",
            icon: Database,
          },
          {
            label: "Files",
            value: String(
              data.files.filter(
                (f) =>
                  f.workspace === workspace && !f.trashed && f.kind !== "folder",
              ).length,
            ),
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
            <CardDescription>A little of everything.</CardDescription>
          </CardHeader>
          <CardContent className="donut-layout">
            <div
              className="storage-donut"
              role="img"
              aria-label="Videos 42%, images 28%, documents 18%, other 12%"
            >
              <div>
                <strong>824</strong>
                <span>GB used</span>
              </div>
            </div>
            <div className="chart-legend">
              {[
                ["Videos", "346 GB", "green"],
                ["Images", "231 GB", "purple"],
                ["Documents", "148 GB", "amber"],
                ["Other", "99 GB", "blue"],
              ].map(([n, v, c]) => (
                <div key={n}>
                  <i className={c} />
                  <span>{n}</span>
                  <strong>{v}</strong>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Growing with your ideas</CardTitle>
            <CardDescription>
              Storage usage over the last 6 months
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GrowthChart />
          </CardContent>
        </Card>
      </div>
      <div className="analytics-grid">
        <Card>
          <CardHeader>
            <CardTitle>Storage provider</CardTitle>
            <CardDescription>
              One provider holds every file in this workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {active ? (
              <>
                <div className="flex items-center gap-3">
                  <Image
                    src={`/icons/${active.provider.icon}.svg`}
                    alt=""
                    width={21}
                    height={21}
                  />
                  <strong className="font-medium">{active.provider.name}</strong>
                </div>
                <dl className="info-list mt-5">
                  <div>
                    <dt>Used</dt>
                    <dd>824 GB</dd>
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
                  onClick={() =>
                    router.push(`${base}/settings?section=storage`)
                  }
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
            <CardTitle>
              {workspace === "personal" ? "Storage by folder" : "Team usage"}
            </CardTitle>
            <CardDescription>Where your work lives.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="usage-list">
              {(workspace === "personal"
                ? [
                    ["Projects", "420 GB", 51],
                    ["Design assets", "180 GB", 22],
                    ["Photography", "140 GB", 17],
                    ["Documents", "84 GB", 10],
                  ]
                : [
                    ["Engineering", "420 GB", 51],
                    ["Design", "180 GB", 22],
                    ["Marketing", "84 GB", 10],
                    ["Other", "140 GB", 17],
                  ]
              ).map(([name, size, progress]) => (
                <div key={String(name)}>
                  <span>{name}</span>
                  <strong>{size}</strong>
                  <Progress value={Number(progress)} />
                </div>
              ))}
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
                  {data.files.find((x) => x.id === f.parent)?.name ||
                    "My Drive"}
                </TableCell>
                <TableCell>
                  {new Date(f.modified).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </>
  );
}
