"use client";

import { AppHeader, EmptyState } from "./_shared";
import { usePyraData } from "@/hooks/use-pyra-data";

export function FaultTimelineApp() {
  const { data, loading, error, selectedInverter, setSelectedInverter } = usePyraData();

  if (loading) return <EmptyState showCmd={false} title="Herding photons…" />;
  if (error || !data) return <EmptyState title="No analytics yet" hint="Run the pipeline first." />;

  const id = selectedInverter ?? data.ledger[0]?.inverterId;
  const fault = id ? data.faults[id] : undefined;
  const perf = id ? data.performance[id] : undefined;

  // Align error counts to the performance month axis so the lost-energy
  // story and the fault bursts share a timeline.
  const months = perf?.monthly.map((m) => m.t) ?? [];
  const countByMonth = new Map((fault?.monthly ?? []).map((m) => [m.t, m.count]));
  const maxCount = Math.max(1, ...(fault?.monthly ?? []).map((m) => m.count));

  return (
    <div className="custom-scrollbar flex h-full flex-col overflow-y-auto">
      <AppHeader
        title="Fault Timeline"
        subtitle="Error-code bursts + service tickets over time"
        right={
          <select
            value={id}
            onChange={(e) => setSelectedInverter(e.target.value)}
            className="font-mono rounded px-2 py-1 text-[12px] outline-none"
            style={{ background: "var(--color-input-bg)", border: "1px solid var(--color-input-border)", color: "var(--color-text)" }}
          >
            {data.ledger.map((r) => (
              <option key={r.inverterId} value={r.inverterId}>{r.inverterId}</option>
            ))}
          </select>
        }
      />

      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[12px] font-medium" style={{ color: "var(--color-text)" }}>
          Error events per month
        </span>
        <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
          {fault?.total ?? 0} total events
        </span>
      </div>
      <div className="flex items-end gap-px" style={{ height: 90 }}>
        {months.map((t) => {
          const c = countByMonth.get(t) ?? 0;
          return (
            <div
              key={t}
              className="flex-1"
              title={`${t}: ${c} events`}
              style={{
                height: `${(c / maxCount) * 100}%`,
                minHeight: c > 0 ? 2 : 0,
                background: c > 0 ? "var(--color-error)" : "transparent",
                borderRadius: 1,
              }}
            />
          );
        })}
      </div>
      <div className="mt-0.5 flex justify-between text-[9px]" style={{ color: "var(--color-text-dim)" }}>
        <span>{months[0]}</span>
        <span>{months[months.length - 1]}</span>
      </div>

      <div className="mt-5 text-[12px] font-medium" style={{ color: "var(--color-text)" }}>
        Top error codes
      </div>
      <div className="mt-2 space-y-1.5">
        {(fault?.topCodes ?? []).map((c) => (
          <div key={c.code} className="flex items-start gap-2 text-[12px]">
            <span className="font-mono shrink-0 rounded px-1.5 py-0.5 text-[10.5px]" style={{ background: "var(--color-info-box)", color: "var(--color-warn)" }}>
              {c.code}
            </span>
            <span className="flex-1" style={{ color: "var(--color-text-secondary)" }}>{c.description}</span>
            <span className="shrink-0 tabular-nums" style={{ color: "var(--color-text-muted)" }}>×{c.count}</span>
          </div>
        ))}
        {(!fault || fault.topCodes.length === 0) && (
          <div className="text-[12px]" style={{ color: "var(--color-text-dim)" }}>No error codes recorded.</div>
        )}
      </div>

      <div className="mt-5 text-[12px] font-medium" style={{ color: "var(--color-text)" }}>
        Plant service tickets <span style={{ color: "var(--color-text-dim)" }}>({data.tickets.length})</span>
      </div>
      <div className="custom-scrollbar mt-2 max-h-[150px] space-y-1 overflow-y-auto pr-1">
        {data.tickets.slice(0, 40).map((t, i) => (
          <div key={i} className="flex items-center gap-2 text-[11.5px]" style={{ color: "var(--color-text-muted)" }}>
            <span className="font-mono shrink-0" style={{ color: "var(--color-text-dim)" }}>{t.start?.slice(0, 10)}</span>
            <span className="truncate" style={{ color: "var(--color-text-secondary)" }}>{t.component}</span>
            <span className="ml-auto shrink-0 truncate" style={{ maxWidth: 180 }}>{t.category}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[10.5px]" style={{ color: "var(--color-text-dim)" }}>
        Tickets are plant-level; align bursts above with the inverter&apos;s loss to trace cause.
      </div>
    </div>
  );
}
