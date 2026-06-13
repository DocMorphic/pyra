"use client";

import { AppHeader, Stat, EmptyState, SectionCard } from "./_shared";
import { usePyraData } from "@/hooks/use-pyra-data";
import { eur, FAULT_CAT_COLOR } from "@/lib/artifacts";

export function FaultEconApp() {
  const { data, loading, error } = usePyraData();

  if (loading) return <EmptyState showCmd={false} title="Costing the faults…" />;
  if (error || !data?.faultEcon) return <EmptyState title="No fault economics" hint="Run python pipeline/fault_econ.py" />;

  const fe = data.faultEcon;
  const cats = fe.categories.filter((c) => c.category !== "unattributed");
  const maxEur = Math.max(...cats.map((c) => c.lostEur), 1);

  return (
    <div className="custom-scrollbar flex h-full flex-col overflow-y-auto">
      <AppHeader
        title="Fault Economics"
        subtitle="Every German error code categorised, then priced — validated loss attributed to the nearest fault onset."
      />

      <div className="mb-3 flex gap-2">
        <Stat label="Fault-attributed €" value={eur(fe.totalAttributedEur)} tone="error" />
        <Stat label="of total loss" value={`${Math.round(fe.attributedFraction * 100)}%`} tone="warn" />
        <Stat label="Fault onsets" value={fe.totalOnsets.toLocaleString("en-US")} />
      </div>

      <SectionCard title="Cost by fault category" color="#b62ad9">
        <div className="space-y-2">
          {cats.map((c) => (
            <div key={c.category} className="flex items-center gap-2.5">
              <div className="w-28 shrink-0 text-[12px] font-medium" style={{ color: "var(--color-text)" }}>
                {c.label}
              </div>
              <div className="relative h-6 flex-1 overflow-hidden rounded" style={{ background: "var(--color-info-box)" }}>
                <div
                  className="absolute inset-y-0 left-0 rounded"
                  style={{ width: `${(c.lostEur / maxEur) * 100}%`, background: FAULT_CAT_COLOR[c.category] ?? "var(--color-accent)" }}
                />
                <div className="absolute inset-y-0 right-2 flex items-center font-mono text-[11px] tabular-nums" style={{ color: "var(--color-text)" }}>
                  {eur(c.lostEur)}
                </div>
              </div>
              <div className="w-24 shrink-0 text-right text-[10.5px]" style={{ color: "var(--color-text-dim)" }}>
                {c.events.toLocaleString("en-US")} ev · {c.invertersAffected} inv
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-[10.5px]" style={{ color: "var(--color-text-dim)" }}>
          Note: isolation alarms fire often but rarely interrupt production — many events, little € — a sign they&apos;re mostly nuisance trips.
        </div>
      </SectionCard>

      <SectionCard title="Costliest error codes" color="#f54e00">
        <div className="custom-scrollbar -mx-1 overflow-x-auto px-1">
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr style={{ color: "var(--color-text-muted)" }} className="text-left">
                <th className="py-1.5 font-medium">Code</th>
                <th className="py-1.5 font-medium">Description</th>
                <th className="py-1.5 text-right font-medium">Count</th>
                <th className="py-1.5 text-right font-medium">Δ kW</th>
                <th className="py-1.5 text-right font-medium">Lost €</th>
              </tr>
            </thead>
            <tbody>
              {fe.topCodes.slice(0, 14).map((c) => (
                <tr key={c.code} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td className="font-mono py-1.5" style={{ color: "var(--color-text-secondary)" }}>{c.code}</td>
                  <td className="py-1.5">
                    <span
                      className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                      style={{ background: FAULT_CAT_COLOR[c.category] ?? "var(--color-text-dim)" }}
                      title={c.category}
                    />
                    <span style={{ color: "var(--color-text)" }}>{truncate(c.description, 52)}</span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--color-text-muted)" }}>{c.count.toLocaleString("en-US")}</td>
                  <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--color-text-muted)" }}>{c.meanDropKw.toFixed(1)}</td>
                  <td className="py-1.5 text-right tabular-nums font-medium" style={{ color: "var(--color-text)" }}>{eur(c.lostEur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="mb-2 text-[10.5px]" style={{ color: "var(--color-text-dim)" }}>
        Of {eur(fe.totalLossEur)} total lost, {eur(fe.totalAttributedEur)} traces to discrete faults; the rest is gradual degradation, soiling and unattributed underperformance (curtailment is excluded upstream). Δ kW = mean power drop in the day after the code fires.
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
