"use client";

import type { DriveListing } from "@/types";
import { format } from "date-fns";
import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { parseDate } from "@/lib/date";
import { formatSize } from "@/lib/workspace/data";

// One series in the neutral ink: blue already means "Images" in the chart beside it.
const chartConfig = {
  bytes: { label: "Storage used", color: "var(--primary)" },
} satisfies ChartConfig;

// Axis labels drop the ".0" formatSize adds to whole numbers: "500 KB", "1.5 MB".
function formatTick(bytes: number) {
  return bytes === 0 ? "0" : formatSize(bytes).replace(".0 ", " ");
}
// Four even steps up to a round top (1, 2, 2.5 or 5 × a power of ten) above `max`.
function niceTicks(max: number) {
  const raw = Math.max(max / 4, 1);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  return Array.from({ length: 5 }, (_, i) => Math.round(i * step));
}

export function GrowthChart({ history }: { history: DriveListing["storageStats"]["byMonth"] }) {
  // Each month: the bytes of files still in the drive that had been added by
  // the end of it (deleted files aren't kept, so they don't count back in time).
  const data = useMemo(
    () =>
      history.flatMap(({ month, bytes }) => {
        const date = parseDate(month);
        return date
          ? [{ month: format(date, "MMM"), label: format(date, "MMMM yyyy"), bytes }]
          : [];
      }),
    [history]
  );
  const last = data.length - 1;
  // An empty drive still gets a readable grid (0 to 1 GB).
  const ticks = niceTicks(Math.max(0, ...data.map((d) => d.bytes)) || 1_000_000_000);

  return (
    <div className="w-full">
      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-52.5 w-full"
        initialDimension={{ width: 560, height: 210 }}
      >
        <AreaChart
          accessibilityLayer
          data={data}
          margin={{ top: 22, right: 16, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            padding={{ left: 14, right: 14 }}
          />
          <YAxis
            ticks={ticks}
            domain={[0, ticks[ticks.length - 1]]}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            width={64}
            tickFormatter={formatTick}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                // "dot" keeps the month label above the row; the row draws its own line key.
                indicator="dot"
                labelFormatter={(_, payload) => payload[0]?.payload?.label}
                formatter={(value) => (
                  <div className="flex items-center gap-2 leading-none">
                    <i aria-hidden="true" className="h-0.5 w-3 rounded-xs bg-primary" />
                    <span className="font-medium text-foreground tabular-nums">
                      {formatSize(Number(value))}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Area
            dataKey="bytes"
            type="linear"
            stroke="var(--color-bytes)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="var(--color-bytes)"
            fillOpacity={0.08}
            dot={false}
            activeDot={{ r: 4, fill: "var(--color-bytes)", stroke: "var(--card)", strokeWidth: 2 }}
            isAnimationActive={false}
          >
            {/* The latest month: an end marker and its value, labeled directly. */}
            <LabelList
              dataKey="bytes"
              content={(props) => {
                const { index, x, y, value } = props as {
                  index?: number;
                  x?: number | string;
                  y?: number | string;
                  value?: number | string;
                };
                if (index !== last || x == null || y == null) return null;
                return (
                  <g>
                    <circle
                      cx={Number(x)}
                      cy={Number(y)}
                      r={4}
                      fill="var(--color-bytes)"
                      stroke="var(--card)"
                      strokeWidth={2}
                    />
                    <text
                      x={Number(x)}
                      y={Number(y) - 12}
                      textAnchor="end"
                      className="fill-foreground text-[12px] font-medium"
                    >
                      {formatSize(Number(value))}
                    </text>
                  </g>
                );
              }}
            />
          </Area>
        </AreaChart>
      </ChartContainer>
      <table className="sr-only">
        <caption>Storage used per month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Storage used</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{formatSize(d.bytes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
