"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { format } from "date-fns";

const months = 6;
const height = 210;
// Left gutter fits the y-axis labels; the bottom band fits the month labels.
const pad = { top: 18, right: 12, bottom: 30, left: 56 };
const inset = 14;
function formatGb(gb: number) {
  if (gb === 0) return "0";
  return gb >= 1000
    ? `${(gb / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 })} TB`
    : `${gb.toLocaleString("en-US")} GB`;
}
export function GrowthChart({ usedBytes }: { usedBytes: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // Measure instead of scaling a viewBox so strokes and dots keep their size.
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(240, Math.round(entry.contentRect.width)))
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // History isn't tracked per month yet: the current usage is the only real
  // point, so the series grows flat toward it over the trailing six months.
  const usage = useMemo(() => {
    const gb = Math.max(0, usedBytes / 1_000_000_000);
    const now = new Date();
    return Array.from({ length: months }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
      return {
        month: format(date, "MMM"),
        label: format(date, "MMMM"),
        gb,
      };
    });
  }, [usedBytes]);
  const max = Math.max(50, Math.ceil((usage[months - 1]?.gb ?? 0) / 250) * 250);
  const ticks = useMemo(
    () => Array.from({ length: 5 }, (_, i) => Math.round((max / 4) * i)),
    [max]
  );
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const last = months - 1;
  const x = (i: number) => pad.left + inset + (i * (plotWidth - inset * 2)) / last;
  const y = (gb: number) => pad.top + plotHeight - (gb / max) * plotHeight;
  const baseline = y(0);
  const line = usage.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.gb)}`).join(" ");
  const area = `${line} L${x(last)},${baseline} L${x(0)},${baseline} Z`;
  function nearest(clientX: number) {
    const left = ref.current?.getBoundingClientRect().left ?? 0;
    const pointer = clientX - left;
    return usage.reduce(
      (best, _, i) => (Math.abs(x(i) - pointer) < Math.abs(x(best) - pointer) ? i : best),
      0
    );
  }
  function onKeyDown(e: KeyboardEvent) {
    const moves: Record<string, (i: number) => number> = {
      ArrowLeft: (i) => Math.max(0, i - 1),
      ArrowRight: (i) => Math.min(last, i + 1),
      Home: () => 0,
      End: () => last,
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    setActive((i) => move(i ?? last));
  }
  const point = active === null ? null : usage[active];
  return (
    <div
      ref={ref}
      className="relative w-full touch-pan-y rounded-[8px] outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring focus-visible:outline-solid"
      role="group"
      tabIndex={0}
      aria-label="Storage usage over the last 6 months. Use the arrow keys to read each month."
      onPointerMove={(e) => setActive(nearest(e.clientX))}
      onPointerDown={(e) => setActive(nearest(e.clientX))}
      onPointerLeave={() => setActive(null)}
      onFocus={() => setActive((i) => i ?? last)}
      onBlur={() => setActive(null)}
      onKeyDown={onKeyDown}
    >
      <svg width={width} height={height} className="block overflow-visible" aria-hidden="true">
        {ticks.map((t) => (
          <g key={t}>
            <line
              className="stroke-border stroke-1 [shape-rendering:crispEdges]"
              x1={pad.left}
              x2={width - pad.right}
              y1={y(t)}
              y2={y(t)}
            />
            <text
              className="fill-muted-foreground text-[11px] tabular-nums"
              x={pad.left - 10}
              y={y(t)}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {formatGb(t)}
            </text>
          </g>
        ))}
        {usage.map((d, i) => (
          <text
            key={d.month + i}
            className="fill-muted-foreground text-[11px] tabular-nums data-active:fill-foreground"
            data-active={active === i || undefined}
            x={x(i)}
            y={height - 8}
            textAnchor="middle"
          >
            {d.month}
          </text>
        ))}
        <path className="fill-primary [fill-opacity:0.08]" d={area} />
        <path
          className="fill-none stroke-primary stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
          d={line}
        />
        {active !== null && (
          <line
            className="stroke-foreground/30 stroke-1 [shape-rendering:crispEdges]"
            x1={x(active)}
            x2={x(active)}
            y1={pad.top}
            y2={baseline}
          />
        )}
        {active !== null && active !== last && (
          <circle
            className="fill-primary stroke-card stroke-2"
            cx={x(active)}
            cy={y(usage[active].gb)}
            r={4}
          />
        )}
        <circle
          className="fill-primary stroke-card stroke-2"
          cx={x(last)}
          cy={y(usage[last].gb)}
          r={4}
        />
        {active === null && (
          <text
            className="fill-foreground text-[12px] font-medium"
            x={x(last)}
            y={y(usage[last].gb) - 12}
            textAnchor="end"
          >
            {formatGb(usage[last].gb)}
          </text>
        )}
      </svg>
      {point && active !== null && (
        <div
          className="pointer-events-none absolute z-5 flex translate-x-3 flex-col gap-0.5 rounded-[9px] border bg-popover px-2.5 py-1.75 whitespace-nowrap shadow-[0_8px_20px_-8px_rgb(24_24_27/0.25)] data-[side=left]:translate-x-[calc(-100%-12px)] dark:shadow-[0_8px_20px_-8px_rgb(0_0_0/0.6)]"
          data-side={x(active) > width / 2 ? "left" : "right"}
          style={{ left: x(active), top: pad.top }}
          aria-live="polite"
        >
          <strong className="text-[13px] font-semibold text-foreground">
            {formatGb(point.gb)}
          </strong>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <i className="h-0.5 w-3 rounded-xs bg-primary" aria-hidden="true" />
            {point.label}
          </span>
        </div>
      )}
      <table className="sr-only">
        <caption>Storage used per month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Storage used</th>
          </tr>
        </thead>
        <tbody>
          {usage.map((d) => (
            <tr key={d.month}>
              <th scope="row">{d.label}</th>
              <td>{formatGb(d.gb)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
