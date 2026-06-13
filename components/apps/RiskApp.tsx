"use client";

import { AppHeader, Stat, EmptyState, SectionCard, GatedEmpty } from "./_shared";
import { usePyraData } from "@/hooks/use-pyra-data";
import { riskColor } from "@/lib/artifacts";

export function RiskApp() {
  const { data, loading, error, selectInverter, selectedInverter, capabilityOf } = usePyraData();

  if (loading) return <EmptyState showCmd={false} title="Scoring the fleet…" />;
  const cap = capabilityOf("risk");
  if (cap.status !== "ok") return <GatedEmpty cap={cap} />;
  if (error || !data?.risk) return <EmptyState title="No risk data" hint="Run python pipeline/risk.py" />;

  const risk = data.risk;
  const tl = risk.ticketLink;
  const ranked = risk.ranked.map((id) => ({ id, ...risk.perInverter[id] }));
  const highCount = ranked.filter((r) => r.risk >= 50).length;

  return (
    <div className="custom-scrollbar flex h-full flex-col overflow-y-auto">
      <AppHeader
        title="Fleet Risk"
        subtitle={`Service-priority score per inverter · as of ${risk.asOf}`}
      />

      <div className="mb-3 flex gap-2">
        <Stat label="High-risk (≥50)" value={String(highCount)} tone="error" />
        <Stat label="Top score" value={ranked[0] ? ranked[0].risk.toFixed(0) : "—"} tone="warn" />
        <Stat label="Tickets linked" value={`${tl.linkedTickets}/${tl.totalTickets}`} />
      </div>

      {/* Predictive-validation banner — the twin's signals lead the truck roll */}
      <div
        className="mb-3 rounded-md px-3 py-2.5 text-[12px]"
        style={{ background: "var(--color-info-box)", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}
      >
        <span style={{ color: "var(--color-success)" }}>✓ Validated: </span>
        our error onsets preceded <b style={{ color: "var(--color-text)" }}>{tl.withPrecedingErrors}</b> of {tl.linkedTickets} inverter
        {" "}maintenance tickets{tl.medianLeadDays != null && <> by a median of <b style={{ color: "var(--color-text)" }}>{tl.medianLeadDays} days</b></>} — the twin flags failures before the truck rolls.
      </div>

      <SectionCard title="Service priority (highest risk first)" color="#f54e00">
        <div className="space-y-1.5">
          {ranked.slice(0, 18).map((r, i) => {
            const active = r.id === selectedInverter;
            return (
              <button
                key={r.id}
                onClick={() => selectInverter(r.id)}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors"
                style={{ background: active ? "var(--color-surface-hover)" : "transparent", border: "1px solid var(--color-border)" }}
              >
                <span className="w-5 text-center text-[11px] tabular-nums" style={{ color: "var(--color-text-dim)" }}>{i + 1}</span>
                {/* risk dial */}
                <span
                  className="font-mono flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold tabular-nums"
                  style={{ background: riskColor(r.risk), color: "#fff" }}
                >
                  {r.risk.toFixed(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[12px]" style={{ color: "var(--color-text)" }}>{r.id}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {r.drivers.map((d) => (
                      <span
                        key={d.key}
                        className="rounded px-1.5 py-0.5 text-[10px]"
                        style={{ background: "var(--color-info-box)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}
                      >
                        {d.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="shrink-0 text-right text-[10.5px]" style={{ color: "var(--color-text-dim)" }}>
                  <div>{Math.round(r.health * 100)}% health</div>
                  <div>{r.recentErrors12mo} errs · {r.tickets} tix</div>
                </div>
              </button>
            );
          })}
        </div>
      </SectionCard>

      <div className="mb-2 text-[10.5px]" style={{ color: "var(--color-text-dim)" }}>
        Score blends health, degradation, recent fault rate &amp; trend, DC faults, peer-delta and recent tickets — each kept as a driver chip. Click a row to inspect.
      </div>
    </div>
  );
}
