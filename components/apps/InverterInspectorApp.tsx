"use client";

import { AppHeader, Stat } from "./_shared";

export function InverterInspectorApp() {
  return (
    <div className="flex h-full flex-col">
      <AppHeader
        title="Inverter Inspector"
        subtitle="Actual vs expected power · degradation · DC diagnostics"
      />
      <div className="mb-3 flex gap-2">
        <Stat label="Inverter" value="—" tone="accent" />
        <Stat label="Health" value="—" />
        <Stat label="Degradation/yr" value="—" tone="warn" />
      </div>
      <div
        className="flex flex-1 items-center justify-center rounded-lg"
        style={{ background: "var(--color-surface-alt)", border: "1px dashed var(--color-border-strong)" }}
      >
        <span className="px-6 text-center text-[12px]" style={{ color: "var(--color-text-muted)" }}>
          Actual-vs-expected power chart and year-over-year degradation curve
          render here. Open an inverter from the Loss Ledger or Plant Map.
        </span>
      </div>
    </div>
  );
}
