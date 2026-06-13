"use client";

import { AppHeader, Stat, EmptyState, SectionCard } from "./_shared";
import { UplotChart } from "./_uplot";
import { usePyraData } from "@/hooks/use-pyra-data";
import { eur, kwh } from "@/lib/artifacts";

export function SoilingApp() {
  const { data, loading, error } = usePyraData();

  if (loading) return <EmptyState showCmd={false} title="Watching the dust settle…" />;
  if (error || !data?.soiling) return <EmptyState title="No soiling data" hint="Run python pipeline/soiling.py" />;

  const s = data.soiling;
  const xs = s.series.map((p) => Date.parse(`${p.t}T00:00:00Z`) / 1000);
  const vs = s.series.map((p) => p.v);
  const ref = s.series.map(() => 1.0);

  return (
    <div className="custom-scrollbar flex h-full flex-col overflow-y-auto">
      <AppHeader
        title="Soiling · Plant B"
        subtitle={`Clear-sky performance index from pvlib · ${s.coords.lat}°N ${s.coords.lon}°E · ${s.kWp.toLocaleString("en-US")} kWp`}
      />

      <div className="mb-3 flex gap-2">
        <Stat label="Soiling rate" value={s.soilingRatePctPerDay != null ? `${s.soilingRatePctPerDay}%/d` : "—"} tone="warn" />
        <Stat label="Avg soiling loss" value={`${s.totalSoilingLossPct}%`} tone="error" />
        <Stat label="Annual cost" value={eur(s.annualSoilingLossEur)} tone="error" />
      </div>

      <div className="mb-1 flex items-center justify-between">
        <span className="text-[12px] font-medium" style={{ color: "var(--color-text)" }}>
          Soiling ratio (clear days) — the dust-then-rain sawtooth
        </span>
        <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
          {s.clearDays} clear days · median PR {(s.meanPR * 100).toFixed(0)}%
        </span>
      </div>
      <UplotChart
        height={200}
        data={[xs, ref, vs]}
        series={[
          { label: "Clean baseline", stroke: "#6aa84f", width: 1, dash: [4, 4] },
          { label: "Soiling ratio", stroke: "#2f80fa", width: 1.75 },
        ]}
      />
      <div className="mt-2 mb-3 flex flex-wrap items-center gap-4 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
        <span className="flex items-center gap-1.5"><span style={{ width: 16, height: 0, borderTop: "2px solid #2f80fa", display: "inline-block" }} /> measured ÷ recently-cleaned envelope</span>
        <span className="flex items-center gap-1.5"><span style={{ width: 16, height: 0, borderTop: "2px dashed #6aa84f", display: "inline-block" }} /> clean (1.0)</span>
      </div>

      <SectionCard title="Detected soiling episodes" color="#2f80fa">
        <div className="custom-scrollbar -mx-1 max-h-[200px] overflow-y-auto px-1">
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr style={{ color: "var(--color-text-muted)" }} className="text-left">
                <th className="sticky top-0 bg-[var(--color-surface-solid)] py-1.5 font-medium">Onset</th>
                <th className="sticky top-0 bg-[var(--color-surface-solid)] py-1.5 font-medium">Trough</th>
                <th className="sticky top-0 bg-[var(--color-surface-solid)] py-1.5 text-right font-medium">Depth</th>
                <th className="sticky top-0 bg-[var(--color-surface-solid)] py-1.5 text-right font-medium">Rate %/d</th>
              </tr>
            </thead>
            <tbody>
              {s.episodes.map((e) => (
                <tr key={e.start} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td className="font-mono py-1.5" style={{ color: "var(--color-text-secondary)" }}>{e.start}</td>
                  <td className="font-mono py-1.5" style={{ color: "var(--color-text-muted)" }}>{e.trough}</td>
                  <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--color-text)" }}>−{e.depthPct}%</td>
                  <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--color-text-muted)" }}>{e.ratePctPerDay}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="mb-2 text-[10.5px]" style={{ color: "var(--color-text-dim)" }}>
        Episodes cluster in spring/summer — consistent with pollen-season soiling, reset by rain. Estimated ~{kwh(s.annualSoilingLossKwh)}/yr lost. A targeted cleaning before pollen season would recover most of it.
      </div>
    </div>
  );
}
