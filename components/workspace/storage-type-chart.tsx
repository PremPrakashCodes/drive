"use client";

import type { DriveListing } from "@/types";
import { Label, Pie, PieChart } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatSize } from "@/lib/workspace/data";

// Each file-type group keeps one color whatever its size. Four marks is the most
// whose colors stay distinguishable side by side (checked against the card in
// light and dark), so the smaller families fold into "Other".
const chartConfig = {
  images: { label: "Images", color: "var(--chart-1)" },
  videos: { label: "Videos", color: "var(--chart-2)" },
  documents: { label: "Documents", color: "var(--chart-3)" },
  other: { label: "Other", color: "var(--chart-4)" },
} satisfies ChartConfig;
type GroupKey = keyof typeof chartConfig;
const groupKinds: Record<Exclude<GroupKey, "other">, string[]> = {
  images: ["image"],
  videos: ["video"],
  documents: ["pdf", "document", "spreadsheet"],
};
const named = new Set(Object.values(groupKinds).flat());
const otherLabel: Record<string, string> = { audio: "Audio", archive: "Archives", code: "Code" };

const percent = (share: number) => (share < 0.01 ? "<1%" : `${Math.round(share * 100)}%`);

export function StorageTypeChart({
  byKind,
  usedBytes,
}: {
  byKind: DriveListing["storageStats"]["byKind"];
  usedBytes: number;
}) {
  const total = byKind.reduce((sum, k) => sum + k.size, 0);
  const segments = (Object.keys(chartConfig) as GroupKey[])
    .map((key) => {
      const members = byKind.filter((k) =>
        key === "other" ? !named.has(k.kind) : groupKinds[key].includes(k.kind)
      );
      const size = members.reduce((sum, k) => sum + k.size, 0);
      return {
        key,
        label: chartConfig[key].label,
        detail: key === "other" ? members.map((k) => otherLabel[k.kind] ?? k.kind).join(", ") : "",
        size,
        share: total ? size / total : 0,
        fill: `var(--color-${key})`,
      };
    })
    .filter((s) => s.size > 0);
  const [value, unit] = formatSize(usedBytes).split(" ");

  return (
    <div className="flex w-full items-center gap-7.5 max-[1200px]:flex-col max-md:flex-row">
      <ChartContainer
        config={chartConfig}
        className="aspect-square size-37.5 shrink-0"
        initialDimension={{ width: 150, height: 150 }}
      >
        <PieChart accessibilityLayer={segments.length > 0}>
          {segments.length > 0 && (
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  nameKey="key"
                  formatter={(_, __, item) => {
                    const segment = item.payload as (typeof segments)[number];
                    return (
                      <>
                        <i
                          aria-hidden="true"
                          className="size-2.5 shrink-0 rounded-xs"
                          style={{ background: chartConfig[segment.key].color }}
                        />
                        <div className="flex flex-1 items-center justify-between gap-3 leading-none">
                          <span className="text-muted-foreground">
                            {segment.detail
                              ? `${segment.label} · ${segment.detail}`
                              : segment.label}
                          </span>
                          <span className="font-medium text-foreground tabular-nums">
                            {formatSize(segment.size)} · {percent(segment.share)}
                          </span>
                        </div>
                      </>
                    );
                  }}
                />
              }
            />
          )}
          <Pie
            data={segments.length ? segments : [{ key: "empty", size: 1, fill: "var(--muted)" }]}
            dataKey="size"
            nameKey="key"
            innerRadius={56}
            outerRadius={75}
            startAngle={90}
            endAngle={-270}
            // A 2px card-colored gap between neighbors; none around a lone ring.
            stroke="var(--card)"
            strokeWidth={segments.length > 1 ? 2 : 0}
            isAnimationActive={false}
          >
            <Label
              content={({ viewBox }) =>
                viewBox && "cx" in viewBox && "cy" in viewBox ? (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) - 6}
                      className="fill-foreground text-[27px] font-medium"
                    >
                      {value}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) + 17}
                      className="fill-muted-foreground text-[10px]"
                    >
                      {unit} used
                    </tspan>
                  </text>
                ) : null
              }
            />
          </Pie>
        </PieChart>
      </ChartContainer>
      {segments.length ? (
        <ul className="flex w-full min-w-0 flex-1 flex-col gap-3.75">
          {segments.map((s) => (
            <li
              key={s.key}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 text-[11px]"
            >
              <i
                aria-hidden="true"
                className="size-2 rounded-xs"
                style={{ background: chartConfig[s.key].color }}
              />
              <span className="min-w-0 truncate">
                {s.label}
                {s.detail && <span className="text-muted-foreground"> · {s.detail}</span>}
              </span>
              <span className="text-muted-foreground tabular-nums">{percent(s.share)}</span>
              <strong className="font-medium tabular-nums">{formatSize(s.size)}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-muted-foreground">Nothing stored yet.</p>
      )}
      <table className="sr-only">
        <caption>Storage by file type</caption>
        <thead>
          <tr>
            <th scope="col">Type</th>
            <th scope="col">Size</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {segments.map((s) => (
            <tr key={s.key}>
              <th scope="row">{s.detail ? `${s.label} (${s.detail})` : s.label}</th>
              <td>{formatSize(s.size)}</td>
              <td>{percent(s.share)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
