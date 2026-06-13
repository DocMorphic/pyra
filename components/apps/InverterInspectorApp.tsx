"use client";

import { AppHeader, Stat, EmptyState, Sticker, SectionCard } from "./_shared";
import { UplotChart } from "./_uplot";
import { usePyraData } from "@/hooks/use-pyra-data";
import { CAUSE_LABEL, CAUSE_COLOR, eur, kwh, healthColor, riskColor } from "@/lib/artifacts";

export function InverterInspectorApp() {
  const { data, loading, error, selectedInverter, setSelectedInverter, capabilityOf } = usePyraData();

  if (loading) return <EmptyState showCmd={false} title="Herding photons…" />;
  if (error || !data) return <EmptyState title="No analytics yet" hint="Run the pipeline first." />;

  const id = selectedInverter ?? data.ledger[0]?.inverterId;
  const entry = data.ledger.find((r) => r.inverterId === id);
  const perf = id ? data.performance[id] : undefined;
  const info = data.inverters.find((i) => i.inverterId === id);

  if (!entry || !perf) return <EmptyState showCmd={false} mood="happy" title="Pick an inverter" hint="Click one in the Loss Ledger or Plant Map." />;

  // uPlot aligned data: [x, hi, lo, expected, actual] — hi/lo form the CI band.
  const xs = perf.monthly.map((m) => Date.parse(`${m.t}-01T00:00:00Z`) / 1000);
  const chartData = [
    xs,
    perf.monthly.map((m) => m.hi),
    perf.monthly.map((m) => m.lo),
    perf.monthly.map((m) => m.expected),
    perf.monthly.map((m) => m.actual),
  ];
  const firstYear = perf.years[0]?.year;
  const lastYear = perf.years[perf.years.length - 1]?.year;
  const degrRate = entry.degradationRate;
  const dc = id ? data.dc?.perInverter[id] : undefined;
  const risk = id ? data.risk?.perInverter[id] : undefined;

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
        <Stat label="Lost revenue" value={`${eur(entry.lostEur)}`} tone="error" />
        <Stat label="Degradation /yr" value={degrRate != null ? `${degrRate.toFixed(2)}%` : "—"} tone="warn" />
        {risk ? (
          <div className="ph-card flex-1 px-3.5 py-3" style={{ borderBottom: `3px solid ${riskColor(risk.risk)}` }}>
            <div className="ph-label">Risk score</div>
            <div className="font-mono mt-1.5 text-[23px] font-bold tabular-nums leading-none" style={{ color: riskColor(risk.risk) }}>
              {risk.risk.toFixed(0)}
            </div>
          </div>
        ) : (
          <Stat label="Model R²" value={entry.modelR2 != null ? entry.modelR2.toFixed(2) : "—"} />
        )}
      </div>

      <div className="mb-1 flex items-center justify-between">
        <span className="text-[12px] font-medium" style={{ color: "var(--color-text)" }}>
          Actual vs expected power (monthly mean kW) · {eur(entry.lostEurLo)}–{eur(entry.lostEurHi)} lost
        </span>
        <div className="flex items-center gap-2">
          {degrRate != null && degrRate <= -1.5 && (
            <Sticker color="var(--color-salmon)">{degrRate.toFixed(1)}%/yr 📉</Sticker>
          )}
          {entry.onset && (
            <span className="badge error" title="Detected failure onset">onset {entry.onset}</span>
          )}
          <span
            className="rounded px-1.5 py-0.5 text-[10.5px]"
            style={{ color: CAUSE_COLOR[entry.topCause], background: "var(--color-info-box)" }}
          >
            {CAUSE_LABEL[entry.topCause]}
          </span>
        </div>
      </div>
      <UplotChart
        height={210}
        data={chartData}
        bands={[{ series: [1, 2], fill: "rgba(245,78,0,0.10)" }]}
        series={[
          { label: "CI hi", stroke: "transparent", width: 0 },
          { label: "CI lo", stroke: "transparent", width: 0 },
          { label: "Expected (yr-1 model ±95%)", stroke: "#9a9b92", dash: [5, 3], width: 1.5 },
          { label: "Actual", stroke: "#f54e00", width: 1.75 },
        ]}
      />

      {/* compact legend */}
      <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
        <span className="flex items-center gap-1.5">
          <span style={{ width: 16, height: 0, borderTop: "2px dashed #9a9b92", display: "inline-block" }} />
          Expected (yr-1 model, ±95% band)
        </span>
        <span className="flex items-center gap-1.5">
          <span style={{ width: 16, height: 0, borderTop: "2px solid #f54e00", display: "inline-block" }} />
          Actual
        </span>
      </div>

      <div className="mt-5 text-[12px] font-medium" style={{ color: "var(--color-text)" }}>
        Normalized yield by year (vs {firstYear} baseline)
      </div>
      <div className="mt-2 flex items-end gap-1.5" style={{ height: 90 }}>
        {perf.years.map((y) => {
          const pr = y.pr ?? 0;
          return (
          <div key={y.year} className="flex h-full flex-1 flex-col items-center justify-end" title={`${y.year}: PR ${(pr * 100).toFixed(0)}%${y.prTc != null ? ` · temp-corr ${(y.prTc * 100).toFixed(0)}%` : ""}`}>
            <div
              className="w-full rounded-t"
              style={{ height: `${Math.max(2, pr * 100)}%`, background: healthColor(pr) }}
            />
            <span className="mt-1 text-[9px]" style={{ color: "var(--color-text-dim)" }}>
              {`'${String(y.year).slice(2)}`}
            </span>
          </div>
          );
        })}
      </div>
      <div className="mt-1 text-[10.5px]" style={{ color: "var(--color-text-dim)" }}>
        Bar = IEC 61724 Performance Ratio per year, {firstYear}–{lastYear}.
      </div>

      {/* DC / string diagnostics — from per-inverter I_DC_SUM / U_DC */}
      {!dc && capabilityOf("dc").status !== "ok" && (
        <div className="mt-5 rounded-md px-3 py-2.5 text-[11.5px]"
          style={{ background: "var(--color-info-box)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
          DC / string diagnostics unavailable — {capabilityOf("dc").reason || "no I_DC / U_DC telemetry in this dataset."}
        </div>
      )}
      {dc && (
        <div className="mt-5">
          <SectionCard title="DC / string health" color="#29dbbb"
            right={
              <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                {dc.nStrings ?? "—"} strings · {dc.nominalUdc} V nominal
              </span>
            }>
            <div className="mb-2 flex gap-2">
              <Stat label="DC→AC efficiency" value={`${(dc.meanEff * 100).toFixed(1)}%`} tone="success" />
              <Stat
                label="DC current vs peers"
                value={dc.chronicRatio != null ? `${(dc.chronicRatio * 100).toFixed(0)}%` : "—"}
                tone={dc.chronicStringsDown ? "error" : "default"}
              />
              <Stat label="DC fault loss" value={kwh(dc.dcLostKwh)} tone={dc.dcLostKwh > 0 ? "warn" : "default"} />
            </div>
            {dc.chronicStringsDown != null && (
              <div className="mb-2 text-[11.5px]" style={{ color: "var(--color-salmon)" }}>
                ⚠ Runs persistently at {(dc.chronicRatio! * 100).toFixed(0)}% of peer DC current — consistent with ≈{dc.chronicStringsDown} string(s) down the whole time.
              </div>
            )}
            {dc.episodes.length > 0 ? (
              <div className="space-y-1">
                <div className="text-[11px] font-medium" style={{ color: "var(--color-text-muted)" }}>
                  {dc.episodes.length} DC-disconnect event(s) — I_DC→0 with voltage healthy:
                </div>
                {dc.episodes.slice(0, 6).map((e) => (
                  <div key={e.start} className="flex items-center justify-between text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                    <span className="font-mono">{e.start} → {e.end}</span>
                    <span>{e.days}d · {kwh(e.lostKwh)} lost</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px]" style={{ color: "var(--color-text-dim)" }}>
                No discrete DC-disconnect events detected — DC current tracks irradiance normally.
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* Risk drivers */}
      {risk && risk.drivers.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>Risk drivers:</span>
          {risk.drivers.map((d) => (
            <span key={d.key} className="rounded px-1.5 py-0.5 text-[10px]"
              style={{ background: "var(--color-info-box)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}>
              {d.label}
            </span>
          ))}
          {risk.tickets > 0 && (
            <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: "var(--color-info-box)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}>
              {risk.tickets} O&amp;M ticket{risk.tickets > 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
