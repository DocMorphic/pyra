"use client";

export function ExecutiveReportApp() {
  return (
    <div className="custom-scrollbar h-full overflow-y-auto">
      {/* Report header band */}
      <div
        className="px-7 py-6"
        style={{
          background:
            "linear-gradient(135deg, var(--color-accent) 0%, color-mix(in srgb, var(--color-accent) 70%, #000) 100%)",
          color: "#fff",
        }}
      >
        <div className="text-[11px] uppercase tracking-[0.2em] opacity-80">Pyra · Executive Report</div>
        <h1 className="mt-1 text-[22px] font-semibold">Plant A — Performance & Loss Summary</h1>
        <p className="mt-1 text-[12.5px] opacity-90">
          Hidden underperformance, quantified in euros, with prioritized O&M actions.
        </p>
      </div>

      <div className="space-y-5 px-7 py-6">
        <Section title="Headline">
          One-click, judge-ready summary: total revenue lost, the top offending
          inverters, the dominant failure modes, and the recommended fixes —
          generated from the analytics artifacts.
        </Section>
        <Section title="Top loss drivers">
          Ranked inverters with euros lost and attributed cause (degradation /
          outage / curtailment / fault).
        </Section>
        <Section title="Recommended actions">
          Prioritized maintenance actions with expected euro recovery.
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 text-[13px] font-semibold" style={{ color: "var(--color-text)" }}>
        {title}
      </h3>
      <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        {children}
      </p>
    </div>
  );
}
