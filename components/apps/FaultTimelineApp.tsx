"use client";

import { AppHeader } from "./_shared";

export function FaultTimelineApp() {
  return (
    <div className="flex h-full flex-col">
      <AppHeader
        title="Fault Timeline"
        subtitle="Error codes + service tickets + lost energy, over time"
      />
      <div
        className="flex flex-1 items-center justify-center rounded-lg"
        style={{ background: "var(--color-surface-alt)", border: "1px dashed var(--color-border-strong)" }}
      >
        <span className="px-6 text-center text-[12px]" style={{ color: "var(--color-text-muted)" }}>
          Timeline overlays inverter error-code bursts, maintenance tickets, and
          the lost-energy band so a drop can be traced to its cause.
        </span>
      </div>
    </div>
  );
}
