"use client";

export function AboutApp() {
  return (
    <div className="flex h-full flex-col items-center px-6 py-4 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: "var(--color-accent)" }}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4.5" fill="#fff" />
          <g stroke="#fff" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.2 5.2l1.8 1.8M17 17l1.8 1.8M18.8 5.2L17 7M7 17l-1.8 1.8" />
          </g>
        </svg>
      </div>

      <h1 className="font-display mt-3 text-[24px] font-semibold" style={{ color: "var(--color-text)" }}>
        Pyra
      </h1>
      <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--color-text-muted)" }}>
        Solar Plant Intelligence
      </p>

      <p className="mt-4 max-w-[400px] text-[12.5px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
        Pyra is a digital-twin O&M console for utility-scale solar. It learns each
        inverter&apos;s expected power from its first year of operation, benchmarks a
        decade of real telemetry against it, and surfaces the underperformance that
        Performance Ratio hides.
      </p>
      <p className="mt-3 max-w-[400px] text-[12.5px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
        It doesn&apos;t just detect — it <strong>explains</strong> the cause from error
        codes and tickets, <strong>quantifies</strong> the euros lost (curtailment-adjusted),
        and turns each finding into an <strong>O&M action</strong>.
      </p>

      <div className="mt-auto pt-4 text-[10.5px]" style={{ color: "var(--color-text-dim)" }}>
        Energy × AI Hackathon · EnerParc Digital-Twin challenge
      </div>
    </div>
  );
}
