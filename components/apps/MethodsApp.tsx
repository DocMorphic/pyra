"use client";

import { AppHeader, Stat, EmptyState } from "./_shared";
import { usePyraData } from "@/hooks/use-pyra-data";
import { eur, kwh } from "@/lib/artifacts";

export function MethodsApp() {
  const { data, loading, error } = usePyraData();
  if (loading) return <EmptyState showCmd={false} title="Herding photons…" />;
  if (error || !data) return <EmptyState title="No analytics yet" hint="Run the pipeline first." />;

  const { metrics, moduleTypes } = data;
  const loc = metrics.location;
  const recon = metrics.reconciliation;
  const lossPct = recon ? ((1 - 1 / recon.ratio) * 100).toFixed(1) : "—";

  const types = Object.entries(moduleTypes).sort((a, b) => b[1].lostEur - a[1].lostEur);
  const maxLost = Math.max(1, ...types.map((t) => t[1].lostEur));

  return (
    <div className="custom-scrollbar flex h-full flex-col overflow-y-auto">
      <AppHeader title="Methods & Validation" subtitle="How the numbers are derived — and why you can trust them" />

      <div className="mb-3 flex gap-2">
        <Stat label="Mean model R²" value={metrics.meanR2 != null ? metrics.meanR2.toFixed(2) : "—"} tone="accent" />
        <Stat label="Physics agreement" value={metrics.medianPhysicsAgreement != null ? metrics.medianPhysicsAgreement.toFixed(2) + "×" : "—"} />
        <Stat label="Meter reconciliation" value={recon ? recon.ratio.toFixed(3) + "×" : "—"} tone="success" />
      </div>

      <Section title="Expected-power model">
        Per-inverter gradient-boosted model trained on each inverter&apos;s <strong>first operating year</strong>
        (features: irradiance, module &amp; ambient temperature, sun elevation), validated on a held-out 20% split.
        Mean out-of-sample R² <strong>{metrics.meanR2?.toFixed(2)}</strong> across {Object.keys(metrics.perInverter).length} inverters.
      </Section>

      <Section title="Independent physics cross-check (pvlib)">
        A first-principles PVWatts model (measured module temperature as cell temperature, standard 14% derate)
        agrees with the ML model to <strong>{metrics.medianPhysicsAgreement?.toFixed(2)}×</strong> on healthy year-1 data —
        two independent methods corroborating the expected-power baseline.
      </Section>

      <Section title="Plant location — recovered from telemetry">
        No coordinate file was provided. We fit the sun&apos;s position to the plant&apos;s solar-elevation track and
        recovered <strong>{loc.lat}°N, {loc.lon}°E</strong>
        {loc.rmse_deg != null && <> (RMSE {loc.rmse_deg}°, {loc.source})</> } — eastern Germany.
      </Section>

      <Section title="Plant-meter reconciliation">
        {recon ? (
          <>Summed inverter energy <strong>{kwh(recon.inverterSumKwh)}</strong> vs the Janitza grid-feed meter{" "}
            <strong>{kwh(recon.plantMeterKwh)}</strong> — a ratio of <strong>{recon.ratio.toFixed(3)}</strong>,
            i.e. ~{lossPct}% transformer/AC loss. Our per-inverter totals reconcile with the physical meter.</>
        ) : "Plant meter not available."}
      </Section>

      <div className="mt-2 mb-1 text-[12px] font-medium" style={{ color: "var(--color-text)" }}>
        Lost revenue by module type
      </div>
      <div className="space-y-1.5">
        {types.map(([t, v]) => (
          <div key={t} className="flex items-center gap-2 text-[11.5px]">
            <span className="w-28 shrink-0 truncate" style={{ color: "var(--color-text-secondary)" }}>{t}</span>
            <div className="relative h-4 flex-1 overflow-hidden rounded" style={{ background: "var(--color-surface-alt)" }}>
              <div className="h-full rounded" style={{ width: `${(v.lostEur / maxLost) * 100}%`, background: "var(--color-accent)" }} />
            </div>
            <span className="w-16 shrink-0 text-right tabular-nums" style={{ color: "var(--color-text)" }}>{eur(v.lostEur)}</span>
            <span className="w-20 shrink-0 text-right tabular-nums" style={{ color: "var(--color-text-muted)" }}
              title="median degradation rate">
              {v.medianDegradationRate != null ? `${v.medianDegradationRate}%/yr` : "—"}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[10.5px]" style={{ color: "var(--color-text-dim)" }}>
        Bars: total lost € per module type. Right column: median degradation rate (%/yr) for that type.
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <h3 className="mb-0.5 text-[12.5px] font-semibold" style={{ color: "var(--color-text)" }}>{title}</h3>
      <p className="text-[12px] leading-relaxed" style={{ color: "var(--color-text-muted)" }}>{children}</p>
    </div>
  );
}
