"use client";

import { AppHeader, Stat } from "./_shared";

export function PlantMapApp() {
  return (
    <div className="flex h-full flex-col">
      <AppHeader
        title="Plant Map"
        subtitle="Inverter health heatmap — Plant A"
      />
      <div className="mb-3 flex gap-2">
        <Stat label="Inverters" value="—" />
        <Stat label="Capacity" value="—" />
        <Stat label="Underperforming" value="—" tone="warn" />
      </div>
      <div
        className="flex flex-1 items-center justify-center rounded-lg"
        style={{ background: "var(--color-surface-alt)", border: "1px dashed var(--color-border-strong)" }}
      >
        <span className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
          Heatmap renders here once analytics artifacts are loaded.
        </span>
      </div>
    </div>
  );
}
