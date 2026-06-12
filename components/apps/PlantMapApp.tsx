"use client";

import { AppHeader, Stat, EmptyState, Sticker } from "./_shared";
import { usePyraData } from "@/hooks/use-pyra-data";
import { eur, healthColor, CAUSE_LABEL } from "@/lib/artifacts";

export function PlantMapApp() {
  const { data, loading, error, selectInverter, selectedInverter } = usePyraData();

  if (loading) return <EmptyState showCmd={false} title="Herding photons…" />;
  if (error || !data)
    return <EmptyState title="No analytics yet" hint="Run the pipeline to map the plant." />;

  const { meta, ledger } = data;
  const byId = new Map(ledger.map((r) => [r.inverterId, r]));
  const sorted = [...ledger].sort((a, b) => a.inverterId.localeCompare(b.inverterId));
  const underperf = ledger.filter((r) => r.health < 0.9).length;

  return (
    <div className="flex h-full flex-col">
      <AppHeader
        title="Plant Map"
        subtitle={`${meta.plant} · inverter health heatmap`}
        right={underperf > 0 && <Sticker color="var(--color-yellow)">{underperf} to watch 👀</Sticker>}
      />
      <div className="mb-3 flex gap-2">
        <Stat label="Inverters" value={String(meta.inverterCount)} />
        <Stat label="Capacity" value={`${(meta.totalKwp / 1000).toFixed(2)} MWp`} />
        <Stat label="Underperforming" value={String(underperf)} tone="warn" />
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto">
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(58px, 1fr))" }}
        >
          {sorted.map((r) => {
            const active = r.inverterId === selectedInverter;
            const short = r.inverterId.replace("INV ", "");
            return (
              <button
                key={r.inverterId}
                onClick={() => selectInverter(r.inverterId)}
                title={`${r.inverterId} · ${(r.health * 100).toFixed(0)}% health · ${eur(r.lostEur)} lost · ${CAUSE_LABEL[r.topCause]}`}
                className="flex aspect-square flex-col items-center justify-center rounded-md p-1 transition-transform"
                style={{
                  background: healthColor(r.health),
                  outline: active ? "2px solid var(--color-text)" : "none",
                  outlineOffset: 1,
                  color: "#0b1220",
                }}
              >
                <span className="text-[9px] font-semibold leading-none opacity-80">{short}</span>
                <span className="mt-0.5 text-[10px] font-bold leading-none tabular-nums">
                  {(r.health * 100).toFixed(0)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[10.5px]" style={{ color: "var(--color-text-muted)" }}>
        <span>Health</span>
        <span className="flex items-center gap-0.5">
          {[0.5, 0.7, 0.85, 0.92, 0.98].map((h) => (
            <span key={h} className="h-3 w-5 rounded-sm" style={{ background: healthColor(h) }} />
          ))}
        </span>
        <span>poor → healthy. Click a cell to inspect.</span>
      </div>
    </div>
  );
}
