"use client";

import { useMemo } from "react";

interface Series {
  label: string;
  color: string;
  points: { x: number; y: number }[];
  dashed?: boolean;
}

/** Minimal responsive line chart (SVG, no deps). x values are indices. */
export function LineChart({
  series,
  height = 200,
  yLabel,
}: {
  series: Series[];
  height?: number;
  yLabel?: string;
}) {
  const W = 600;
  const H = height;
  const pad = { l: 38, r: 12, t: 10, b: 22 };

  const { maxX, maxY } = useMemo(() => {
    let mx = 0,
      my = 0;
    for (const s of series)
      for (const p of s.points) {
        mx = Math.max(mx, p.x);
        my = Math.max(my, p.y);
      }
    return { maxX: mx || 1, maxY: my * 1.1 || 1 };
  }, [series]);

  const sx = (x: number) => pad.l + (x / maxX) * (W - pad.l - pad.r);
  const sy = (y: number) => H - pad.b - (y / maxY) * (H - pad.t - pad.b);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      {/* y gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line
            x1={pad.l}
            x2={W - pad.r}
            y1={sy(maxY * f)}
            y2={sy(maxY * f)}
            stroke="var(--color-border)"
            strokeWidth={1}
          />
          <text x={4} y={sy(maxY * f) + 3} fontSize={9} fill="var(--color-text-dim)">
            {Math.round(maxY * f)}
          </text>
        </g>
      ))}
      {yLabel && (
        <text x={4} y={pad.t} fontSize={9} fill="var(--color-text-muted)">
          {yLabel}
        </text>
      )}
      {series.map((s) => (
        <polyline
          key={s.label}
          fill="none"
          stroke={s.color}
          strokeWidth={1.6}
          strokeDasharray={s.dashed ? "4 3" : undefined}
          points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ")}
        />
      ))}
    </svg>
  );
}

/** Legend chip row. */
export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
          <span
            className="inline-block"
            style={{
              width: 14,
              height: 0,
              borderTop: `2px ${it.dashed ? "dashed" : "solid"} ${it.color}`,
            }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}
