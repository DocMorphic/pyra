"use client";

import { useEffect, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

export interface UplotSeriesDef {
  label: string;
  stroke: string;
  fill?: string;
  width?: number;
  dash?: number[];
  scale?: string;       // y-axis scale key (default "y"); use a 2nd key for dual-axis
  points?: boolean;     // show point markers
}

export interface UplotBand {
  /** 1-based series indices [upper, lower] to fill between. */
  series: [number, number];
  fill: string;
}

interface UplotChartProps {
  /** [xValues, ...ySeries] — x in unix seconds when timeAxis. */
  data: number[][];
  series: UplotSeriesDef[];
  height?: number;
  timeAxis?: boolean;
  /** scale keys that should render a right-side axis (dual-axis). */
  rightAxisScale?: string;
  bands?: UplotBand[];
}

function cssVar(el: HTMLElement, name: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

/** Theme-aware, resize-aware uPlot wrapper. Rebuilds on data/series change. */
export function UplotChart({
  data,
  series,
  height = 220,
  timeAxis = true,
  rightAxisScale,
  bands,
}: UplotChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || data.length === 0) return;

    const axisColor = cssVar(el, "--color-text-dim", "#94a3b8");
    const gridColor = cssVar(el, "--color-border", "#dbe3ec");
    const tickColor = cssVar(el, "--color-border", "#dbe3ec");
    const font = '11px "IBM Plex Mono", ui-monospace, SFMono-Regular, monospace';

    const uSeries: uPlot.Series[] = [
      {}, // x
      ...series.map((s) => ({
        label: s.label,
        stroke: s.stroke,
        fill: s.fill,
        width: s.width ?? 1.5,
        dash: s.dash,
        scale: s.scale ?? "y",
        points: { show: s.points ?? false, size: 4 },
      })),
    ];

    const axes: uPlot.Axis[] = [
      {
        stroke: axisColor,
        grid: { stroke: gridColor, width: 1 },
        ticks: { stroke: tickColor, width: 1 },
        font,
      },
      {
        scale: "y",
        stroke: axisColor,
        grid: { stroke: gridColor, width: 1 },
        ticks: { stroke: tickColor, width: 1 },
        font,
        size: 52,
      },
    ];
    if (rightAxisScale) {
      axes.push({
        scale: rightAxisScale,
        side: 1,
        stroke: axisColor,
        grid: { show: false },
        ticks: { stroke: tickColor, width: 1 },
        font,
        size: 48,
      });
    }

    const opts: uPlot.Options = {
      width: el.clientWidth || 600,
      height,
      scales: { x: { time: timeAxis } },
      series: uSeries,
      axes,
      bands: bands?.map((b) => ({ series: b.series, fill: b.fill })),
      legend: { show: true, live: true },
      cursor: { points: { size: 6 } },
      padding: [8, 8, 0, 0],
    };

    const u = new uPlot(opts, data as uPlot.AlignedData, el);
    plotRef.current = u;

    const ro = new ResizeObserver(() => {
      u.setSize({ width: el.clientWidth || 600, height });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      u.destroy();
      plotRef.current = null;
    };
  }, [data, series, height, timeAxis, rightAxisScale, bands]);

  return <div ref={ref} className="uplot-host w-full" style={{ minHeight: height }} />;
}
