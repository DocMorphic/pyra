"use client";

import { AppHeader, Stat, EmptyState } from "./_shared";
import { usePyraData } from "@/hooks/use-pyra-data";
import { CAUSE_LABEL, CAUSE_COLOR, eur, kwh, healthColor } from "@/lib/artifacts";

export function LossLedgerApp() {
  const { data, loading, error, selectInverter, selectedInverter } = usePyraData();

  if (loading) return <EmptyState showCmd={false} title="Herding photons…" />;
  if (error || !data)
    return <EmptyState title="No analytics yet" hint="Run the pipeline to generate the loss ledger." />;

  const { meta, ledger } = data;

  return (
    <div className="flex h-full flex-col">
      <AppHeader
        title="Loss Ledger"
        subtitle="Lost revenue ranked by inverter · curtailment-adjusted"
      />
      <div className="mb-3 flex gap-2">
        <Stat label="Total lost €" value={eur(meta.totalLostEur ?? 0)} tone="error" />
        <Stat label="Lost energy" value={kwh(meta.totalLostKwh ?? 0)} tone="warn" />
        <Stat label="Inverters" value={String(ledger.length)} />
      </div>

      <div className="custom-scrollbar -mx-1 flex-1 overflow-y-auto px-1">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr style={{ color: "var(--color-text-muted)" }} className="text-left">
              <th className="sticky top-0 bg-[var(--color-surface-solid)] py-1.5 pl-2 font-medium">#</th>
              <th className="sticky top-0 bg-[var(--color-surface-solid)] py-1.5 font-medium">Inverter</th>
              <th className="sticky top-0 bg-[var(--color-surface-solid)] py-1.5 text-right font-medium">Lost €</th>
              <th className="sticky top-0 bg-[var(--color-surface-solid)] py-1.5 text-center font-medium">Health</th>
              <th className="sticky top-0 bg-[var(--color-surface-solid)] py-1.5 font-medium">Cause</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((r, i) => {
              const active = r.inverterId === selectedInverter;
              return (
                <tr
                  key={r.inverterId}
                  onClick={() => selectInverter(r.inverterId)}
                  className="cursor-pointer transition-colors"
                  style={{
                    background: active ? "var(--color-surface-hover)" : "transparent",
                    borderTop: "1px solid var(--color-border)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-alt)")}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = active ? "var(--color-surface-hover)" : "transparent")
                  }
                >
                  <td className="py-1.5 pl-2 tabular-nums" style={{ color: "var(--color-text-dim)" }}>{i + 1}</td>
                  <td className="font-mono py-1.5" style={{ color: "var(--color-text)" }}>{r.inverterId}</td>
                  <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--color-text)" }}>{eur(r.lostEur)}</td>
                  <td className="py-1.5 text-center">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full align-middle"
                      style={{ background: healthColor(r.health) }}
                      title={`${(r.health * 100).toFixed(0)}% of expected`}
                    />
                    <span className="ml-1.5 tabular-nums" style={{ color: "var(--color-text-muted)" }}>
                      {(r.health * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="py-1.5">
                    <span
                      className="rounded px-1.5 py-0.5 text-[10.5px]"
                      style={{ color: CAUSE_COLOR[r.topCause], background: "var(--color-info-box)" }}
                    >
                      {CAUSE_LABEL[r.topCause]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[10.5px]" style={{ color: "var(--color-text-dim)" }}>
        Click a row to inspect actual vs expected power.
      </div>
    </div>
  );
}
