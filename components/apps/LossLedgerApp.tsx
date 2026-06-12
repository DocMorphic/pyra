"use client";

import { AppHeader, Stat } from "./_shared";

export function LossLedgerApp() {
  return (
    <div className="flex h-full flex-col">
      <AppHeader
        title="Loss Ledger"
        subtitle="Lost revenue ranked by inverter — curtailment-adjusted"
      />
      <div className="mb-3 flex gap-2">
        <Stat label="Total lost €" value="—" tone="error" />
        <Stat label="Lost kWh" value="—" tone="warn" />
        <Stat label="Top offender" value="—" tone="accent" />
      </div>
      <div
        className="flex flex-1 items-center justify-center rounded-lg"
        style={{ background: "var(--color-surface-alt)", border: "1px dashed var(--color-border-strong)" }}
      >
        <span className="px-6 text-center text-[12px]" style={{ color: "var(--color-text-muted)" }}>
          Ranked lost-revenue table renders here. Loss = (expected − actual) over
          daylight, non-curtailed intervals × feed-in tariff.
        </span>
      </div>
    </div>
  );
}
