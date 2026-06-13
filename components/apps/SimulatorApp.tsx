"use client";

import { useMemo, useState } from "react";
import { AppHeader, Stat, EmptyState, SectionCard } from "./_shared";
import { UplotChart } from "./_uplot";
import { usePyraData } from "@/hooks/use-pyra-data";
import { eur, kwh, SIM_CAUSE_COLOR, SIM_CAUSE_LABEL, type SimInverter } from "@/lib/artifacts";

type CauseKey = "dc" | "outage" | "fault" | "degradation";
const CAUSES: CauseKey[] = ["dc", "outage", "fault", "degradation"];

export function SimulatorApp() {
  const { data, loading, error, selectInverter } = usePyraData();
  const [active, setActive] = useState<Record<CauseKey, boolean>>({
    dc: true, outage: true, fault: true, degradation: false,
  });
  const [topN, setTopN] = useState(10);
  const [horizon, setHorizon] = useState(5);

  const sim = data?.simulator;
  const entries = useMemo<[string, SimInverter][]>(
    () => (sim ? Object.entries(sim.perInverter) : []),
    [sim]
  );

  // Rank inverters by the €-loss of the currently-selected causes.
  const ranked = useMemo(() => {
    const sel = CAUSES.filter((c) => active[c]);
    return entries
      .map(([id, v]) => ({
        id, v,
        selEur: sel.reduce((s, c) => s + (v.lossByCause[c]?.eur ?? 0), 0),
        selKwh: sel.reduce((s, c) => s + (v.lossByCause[c]?.kwh ?? 0), 0),
      }))
      .filter((r) => r.selEur > 0)
      .sort((a, b) => b.selEur - a.selEur);
  }, [entries, active]);

  const chosen = ranked.slice(0, topN);
  const recoveredEur = chosen.reduce((s, r) => s + r.selEur, 0);
  const recoveredKwh = chosen.reduce((s, r) => s + r.selKwh, 0);

  // Degradation forecast: cumulative € lost to ongoing degradation over the
  // horizon, "do nothing" vs "arrest it on the chosen inverters".
  const forecast = useMemo(() => {
    if (!sim) return null;
    const chosenIds = new Set(chosen.map((r) => r.id));
    const years = Array.from({ length: horizon + 1 }, (_, i) => i);
    let cumNothing = 0, cumAct = 0;
    const doNothing: number[] = [], act: number[] = [];
    for (const t of years) {
      let lossNothing = 0, lossAct = 0;
      for (const [id, v] of entries) {
        const g = (v.degradationRatePctYr ?? 0) / 100; // negative
        if (g >= 0) continue;
        const e0 = v.recentAnnualKwh || 0;
        const yearLoss = e0 * (1 - Math.pow(1 + g, t)) * v.avgTariff;
        lossNothing += yearLoss;
        // acting (degradation toggle) arrests decline on chosen inverters
        lossAct += active.degradation && chosenIds.has(id) ? 0 : yearLoss;
      }
      cumNothing = lossNothing;
      cumAct = lossAct;
      doNothing.push(Math.round(cumNothing));
      act.push(Math.round(cumAct));
    }
    return { years, doNothing, act, saved: cumNothing - cumAct };
  }, [sim, entries, chosen, horizon, active.degradation]);

  if (loading) return <EmptyState showCmd={false} title="Spinning up the twin…" />;
  if (error || !sim) return <EmptyState title="No simulator data" hint="Run python pipeline/simulator.py" />;

  const fleetRecoverable = sim.fleetRecoverableEur;

  return (
    <div className="custom-scrollbar flex h-full flex-col overflow-y-auto">
      <AppHeader
        title="What-if Simulator"
        subtitle="Toggle interventions → recovered revenue, live. Recoverable loss is partitioned so causes never double-count."
      />

      <div className="mb-3 flex gap-2">
        <Stat label="Recovered €" value={eur(recoveredEur)} tone="success" />
        <Stat label="Recovered energy" value={kwh(recoveredKwh)} tone="accent" />
        <Stat label="of fleet recoverable" value={`${fleetRecoverable ? Math.round((recoveredEur / fleetRecoverable) * 100) : 0}%`} />
      </div>

      <SectionCard title="Interventions" color="#29dbbb">
        <div className="flex flex-wrap gap-2">
          {CAUSES.map((c) => {
            const on = active[c];
            const fleetEur = sim.fleetByCause[c]?.eur ?? 0;
            return (
              <button
                key={c}
                onClick={() => setActive((a) => ({ ...a, [c]: !a[c] }))}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-[12px] font-medium transition-all"
                style={{
                  background: on ? SIM_CAUSE_COLOR[c] : "var(--color-info-box)",
                  color: on ? "#fff" : "var(--color-text-muted)",
                  border: `1px solid ${on ? SIM_CAUSE_COLOR[c] : "var(--color-border)"}`,
                  opacity: on ? 1 : 0.7,
                }}
              >
                <span style={{ fontSize: 13 }}>{on ? "✓" : "○"}</span>
                {SIM_CAUSE_LABEL[c]}
                <span className="font-mono tabular-nums" style={{ opacity: 0.85 }}>{eur(fleetEur)}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-1.5 text-[10.5px]" style={{ color: "var(--color-text-dim)" }}>
          Degradation is module-replacement capex (off by default); DC / outage / fault are operational fixes.
        </div>
      </SectionCard>

      <SectionCard title={`Fix the top ${topN} inverters`} color="#f7a501">
        <input
          type="range" min={1} max={Math.max(ranked.length, 1)} value={topN}
          onChange={(e) => setTopN(Number(e.target.value))}
          className="w-full" style={{ accentColor: "var(--color-accent)" }}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chosen.slice(0, 16).map((r) => (
            <button
              key={r.id}
              onClick={() => selectInverter(r.id)}
              className="font-mono rounded px-1.5 py-0.5 text-[10.5px] transition-colors"
              style={{ background: "var(--color-info-box)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}
              title={`${eur(r.selEur)} recoverable — open inspector`}
            >
              {r.id.replace("INV ", "")}
            </button>
          ))}
          {chosen.length > 16 && (
            <span className="px-1 py-0.5 text-[10.5px]" style={{ color: "var(--color-text-dim)" }}>
              +{chosen.length - 16} more
            </span>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Degradation forecast" color="#f35454"
        right={forecast && (
          <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            arrest on chosen → save {eur(forecast.saved)} over {horizon}y
          </span>
        )}>
        <div className="mb-2 flex items-center gap-2 text-[11.5px]" style={{ color: "var(--color-text-muted)" }}>
          <span>Horizon</span>
          <input
            type="range" min={1} max={5} value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
            style={{ accentColor: "var(--color-accent)", width: 120 }}
          />
          <span className="font-mono tabular-nums" style={{ color: "var(--color-text)" }}>{horizon} yr</span>
        </div>
        {forecast && (
          <>
            <UplotChart
              height={170}
              timeAxis={false}
              data={[forecast.years, forecast.doNothing, forecast.act]}
              series={[
                { label: "Do nothing", stroke: "#f35454", width: 2, points: true },
                { label: "Act now (chosen)", stroke: "#6aa84f", width: 2, points: true },
              ]}
            />
            <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
              <span className="flex items-center gap-1.5"><span style={{ width: 16, height: 0, borderTop: "2px solid #f35454", display: "inline-block" }} /> Cumulative € lost to degradation — do nothing</span>
              <span className="flex items-center gap-1.5"><span style={{ width: 16, height: 0, borderTop: "2px solid #6aa84f", display: "inline-block" }} /> Arrest decline on the {topN} chosen{!active.degradation && " (enable Degradation)"}</span>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
