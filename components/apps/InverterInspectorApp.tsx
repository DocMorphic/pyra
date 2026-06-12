"use client";

import { AppHeader, Stat, EmptyState } from "./_shared";
import { UplotChart } from "./_uplot";
import { usePyraData } from "@/hooks/use-pyra-data";
import { CAUSE_LABEL, CAUSE_COLOR, eur, healthColor } from "@/lib/artifacts";

export function InverterInspectorApp() {
  const { data, loading, error, selectedInverter, setSelectedInverter } = usePyraData();

  if (loading) return <EmptyState icon="⏳" title="Loading…" />;
  if (error || !data) return <EmptyState title="No analytics yet" hint="Run the pipeline first." />;

  const id = selectedInverter ?? data.ledger[0]?.inverterId;
  const entry = data.ledger.find((r) => r.inverterId === id);
  const perf = id ? data.performance[id] : undefined;
  const info = data.inverters.find((i) => i.inverterId === id);

  if (!entry || !perf) return <EmptyState title="Select an inverter" hint="Pick one from the Loss Ledger or Plant Map." />;

  // uPlot aligned data: [x (unix s), expected, actual]
  const xs = perf.monthly.map((m) => Date.parse(`${m.t}-01T00:00:00Z`) / 1000);
  const chartData = [
    xs,
    perf.monthly.map((m) => m.expected),
    perf.monthly.map((m) => m.actual),
  ];
  const firstYear = perf.years[0]?.year;
  const lastYear = perf.years[perf.years.length - 1]?.year;
  const degr = perf.years.length > 1 ? (1 - perf.years[perf.years.length - 1].norm) * 100 : 0;

  return (
    <div className="custom-scrollbar flex h-full flex-col overflow-y-auto">
      <AppHeader
        title="Inverter Inspector"
        subtitle={info ? `${info.moduleType} · ${info.kWp ?? "—"} kWp · ${info.strings ?? "—"} strings` : undefined}
        right={
          <select
            value={id}
            onChange={(e) => setSelectedInverter(e.target.value)}
            className="font-mono rounded px-2 py-1 text-[12px] outline-none"
            style={{ background: "var(--color-input-bg)", border: "1px solid var(--color-input-border)", color: "var(--color-text)" }}
          >
            {data.ledger.map((r) => (
              <option key={r.inverterId} value={r.inverterId}>
                {r.inverterId}
              </option>
            ))}
          </select>
        }
      />

      <div className="mb-3 flex gap-2">
        <Stat label="Health" value={`${(entry.health * 100).toFixed(0)}%`} tone={entry.health < 0.8 ? "error" : entry.health < 0.92 ? "warn" : "success"} />
        <Stat label="Lost revenue" value={eur(entry.lostEur)} tone="error" />
        <Stat label="Degradation" value={`${degr.toFixed(0)}%`} tone="warn" />
        <Stat label="Errors" value={String(entry.errorCount)} />
      </div>

      <div className="mb-1 flex items-center justify-between">
        <span className="text-[12px] font-medium" style={{ color: "var(--color-text)" }}>
          Actual vs expected power (monthly mean kW)
        </span>
        <span
          className="rounded px-1.5 py-0.5 text-[10.5px]"
          style={{ color: CAUSE_COLOR[entry.topCause], background: "var(--color-info-box)" }}
        >
          {CAUSE_LABEL[entry.topCause]}
        </span>
      </div>
      <UplotChart
        height={200}
        data={chartData}
        series={[
          { label: "Expected (yr-1 model)", stroke: "#9a9b92", dash: [5, 3], width: 1.5 },
          { label: "Actual", stroke: "#f54e00", width: 1.75 },
        ]}
      />

      <div className="mt-4 text-[12px] font-medium" style={{ color: "var(--color-text)" }}>
        Normalized yield by year (vs {firstYear} baseline)
      </div>
      <div className="mt-2 flex items-end gap-1.5" style={{ height: 90 }}>
        {perf.years.map((y) => (
          <div key={y.year} className="flex h-full flex-1 flex-col items-center justify-end" title={`${y.year}: PR ${(y.pr * 100).toFixed(0)}%`}>
            <div
              className="w-full rounded-t"
              style={{ height: `${Math.max(2, y.pr * 100)}%`, background: healthColor(y.pr) }}
            />
            <span className="mt-1 text-[9px]" style={{ color: "var(--color-text-dim)" }}>
              {`'${String(y.year).slice(2)}`}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 text-[10.5px]" style={{ color: "var(--color-text-dim)" }}>
        Bar = performance ratio (actual ÷ expected) per year, {firstYear}–{lastYear}.
      </div>
    </div>
  );
}
