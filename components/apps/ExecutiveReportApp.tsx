"use client";

import { usePyraData } from "@/hooks/use-pyra-data";
import { CAUSE_LABEL, CAUSE_COLOR, eur, kwh, healthColor, type Cause } from "@/lib/artifacts";
import { EmptyState } from "./_shared";

const ACTION: Record<Cause, string> = {
  outage: "Dispatch a site visit — inverter is offline during production hours.",
  fault: "Investigate recurring error codes; schedule component service.",
  degradation: "Plan module/string inspection; assess for soiling or aging.",
  curtailment: "Review grid/operator curtailment terms — partly external.",
  unknown: "Add to watchlist; gather more telemetry before acting.",
};

export function ExecutiveReportApp() {
  const { data, loading, error } = usePyraData();
  if (loading) return <EmptyState icon="⏳" title="Compiling report…" />;
  if (error || !data) return <EmptyState title="No analytics yet" hint="Run the pipeline first." />;

  const { meta, ledger } = data;
  const top = ledger.slice(0, 5);
  const causeTotals = new Map<Cause, number>();
  for (const r of ledger) causeTotals.set(r.topCause, (causeTotals.get(r.topCause) ?? 0) + r.lostEur);
  const causes = [...causeTotals.entries()].sort((a, b) => b[1] - a[1]);
  const totalEur = meta.totalLostEur ?? 0;

  return (
    <div className="custom-scrollbar h-full overflow-y-auto">
      <div
        className="px-7 py-6"
        style={{
          background:
            "linear-gradient(135deg, var(--color-accent) 0%, color-mix(in srgb, var(--color-accent) 60%, #000) 100%)",
          color: "#0b1220",
        }}
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-70">
          Pyra · Executive Report
        </div>
        <h1 className="mt-1 text-[22px] font-bold">{meta.plant} — Performance & Loss Summary</h1>
        <p className="mt-1 text-[12.5px] opacity-80">
          {meta.inverterCount} inverters · {(meta.totalKwp / 1000).toFixed(2)} MWp · {meta.dateStart.slice(0, 10)} → {meta.dateEnd.slice(0, 10)}
        </p>
        <div className="mt-4 flex gap-6">
          <div>
            <div className="text-[26px] font-bold leading-none">{eur(totalEur)}</div>
            <div className="text-[11px] opacity-70">revenue lost (curtailment-adjusted)</div>
          </div>
          <div>
            <div className="text-[26px] font-bold leading-none">{kwh(meta.totalLostKwh ?? 0)}</div>
            <div className="text-[11px] opacity-70">energy lost vs expected</div>
          </div>
        </div>
      </div>

      <div className="space-y-6 px-7 py-6">
        <section>
          <h3 className="mb-2 text-[13px] font-semibold" style={{ color: "var(--color-text)" }}>
            Top loss drivers
          </h3>
          <div className="space-y-1.5">
            {top.map((r, i) => (
              <div key={r.inverterId} className="flex items-center gap-3 text-[12.5px]">
                <span className="w-4 tabular-nums" style={{ color: "var(--color-text-dim)" }}>{i + 1}</span>
                <span className="font-mono w-28" style={{ color: "var(--color-text)" }}>{r.inverterId}</span>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: healthColor(r.health) }} />
                <span className="flex-1" style={{ color: CAUSE_COLOR[r.topCause] }}>{CAUSE_LABEL[r.topCause]}</span>
                <span className="tabular-nums" style={{ color: "var(--color-text)" }}>{eur(r.lostEur)}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-[13px] font-semibold" style={{ color: "var(--color-text)" }}>
            Loss by cause
          </h3>
          <div className="flex h-3 w-full overflow-hidden rounded-full" style={{ background: "var(--color-surface-alt)" }}>
            {causes.map(([c, v]) => (
              <div key={c} title={`${CAUSE_LABEL[c]}: ${eur(v)}`} style={{ width: `${(v / totalEur) * 100}%`, background: CAUSE_COLOR[c] }} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            {causes.map(([c, v]) => (
              <span key={c} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: CAUSE_COLOR[c] }} />
                {CAUSE_LABEL[c]} · {eur(v)}
              </span>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-[13px] font-semibold" style={{ color: "var(--color-text)" }}>
            Recommended actions
          </h3>
          <div className="space-y-2">
            {top.map((r) => (
              <div key={r.inverterId} className="rounded-lg px-3 py-2" style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)" }}>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-mono" style={{ color: "var(--color-text)" }}>{r.inverterId}</span>
                  <span className="tabular-nums" style={{ color: "var(--color-text-muted)" }}>recover up to {eur(r.lostEur)}/yr-equiv</span>
                </div>
                <p className="mt-0.5 text-[12px]" style={{ color: "var(--color-text-secondary)" }}>{ACTION[r.topCause]}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
