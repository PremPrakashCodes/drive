"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
const usage = [
  { month: "Apr", label: "April", gb: 320 },
  { month: "May", label: "May", gb: 420 },
  { month: "Jun", label: "June", gb: 480 },
  { month: "Jul", label: "July", gb: 620 },
  { month: "Aug", label: "August", gb: 740 },
  { month: "Sep", label: "September", gb: 824 },
];
const ticks = [0, 250, 500, 750, 1000];
const max = 1000;
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
export function GrowthChart() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // Measure instead of scaling a viewBox so strokes and dots keep their size.
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(240, Math.round(entry.contentRect.width))),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const last = usage.length - 1;
  const x = (i: number) =>
    pad.left + inset + (i * (plotWidth - inset * 2)) / last;
  const y = (gb: number) => pad.top + plotHeight - (gb / max) * plotHeight;
  const baseline = y(0);
  const line = usage
    .map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.gb)}`)
    .join(" ");
  const area = `${line} L${x(last)},${baseline} L${x(0)},${baseline} Z`;
  function nearest(clientX: number) {
    const left = ref.current?.getBoundingClientRect().left ?? 0;
    const pointer = clientX - left;
    return usage.reduce(
      (best, _, i) =>
        Math.abs(x(i) - pointer) < Math.abs(x(best) - pointer) ? i : best,
      0,
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
      className="growth-chart"
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
      <svg width={width} height={height} aria-hidden="true">
        {ticks.map((t) => (
          <g key={t}>
            <line
              className="growth-grid"
              x1={pad.left}
              x2={width - pad.right}
              y1={y(t)}
              y2={y(t)}
            />
            <text
              className="growth-tick"
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
            key={d.month}
            className="growth-tick"
            data-active={active === i || undefined}
            x={x(i)}
            y={height - 8}
            textAnchor="middle"
          >
            {d.month}
          </text>
        ))}
        <path className="growth-area" d={area} />
        <path className="growth-line" d={line} />
        {active !== null && (
          <line
            className="growth-crosshair"
            x1={x(active)}
            x2={x(active)}
            y1={pad.top}
            y2={baseline}
          />
        )}
        {active !== null && active !== last && (
          <circle
            className="growth-dot"
            cx={x(active)}
            cy={y(usage[active].gb)}
            r={4}
          />
        )}
        <circle className="growth-dot" cx={x(last)} cy={y(usage[last].gb)} r={4} />
        {active === null && (
          <text
            className="growth-end-label"
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
          className="growth-tooltip"
          data-side={x(active) > width / 2 ? "left" : "right"}
          style={{ left: x(active), top: pad.top }}
          aria-live="polite"
        >
          <strong>{formatGb(point.gb)}</strong>
          <span>
            <i aria-hidden="true" />
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
