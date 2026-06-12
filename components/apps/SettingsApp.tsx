"use client";

import { useTheme, type AccentColor } from "@/hooks/use-theme";

const ACCENTS: { value: AccentColor; swatch: string; label: string }[] = [
  { value: "amber", swatch: "#f59e0b", label: "Solar amber" },
  { value: "gold", swatch: "#fbbf24", label: "Gold" },
  { value: "cyan", swatch: "#22d3ee", label: "Grid cyan" },
];

export function SettingsApp() {
  const { mode, setMode, accent, setAccent, brightness, setBrightness } = useTheme();

  return (
    <div className="space-y-5">
      <Row label="Theme">
        <div
          className="flex overflow-hidden border"
          style={{ borderColor: "var(--color-border)", borderRadius: 6 }}
        >
          {(["light", "dark"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="px-4 py-1.5 text-[12px] transition-colors"
              style={{
                background: mode === m ? "var(--color-accent)" : "transparent",
                color: mode === m ? "#fff" : "var(--color-text)",
                fontWeight: mode === m ? 500 : 400,
              }}
            >
              {m === "light" ? "☀ Day" : "☾ Night"}
            </button>
          ))}
        </div>
      </Row>

      <Row label="Accent">
        <div className="flex gap-2">
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              onClick={() => setAccent(a.value)}
              title={a.label}
              aria-label={a.label}
              className="h-7 w-7 transition-transform"
              style={{
                background: a.swatch,
                borderRadius: "50%",
                border:
                  accent === a.value
                    ? "2px solid var(--color-text)"
                    : "1px solid var(--color-border)",
                transform: accent === a.value ? "scale(1.08)" : "scale(1)",
              }}
            />
          ))}
        </div>
      </Row>

      <Row label="Brightness">
        <div className="w-full">
          <input
            type="range"
            min={70}
            max={100}
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: "var(--color-accent)" }}
          />
          <div className="mt-0.5 text-right text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            {brightness}%
          </div>
        </div>
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[12.5px] font-medium" style={{ color: "var(--color-text)" }}>
        {label}
      </span>
      <div className="flex min-w-[180px] justify-end">{children}</div>
    </div>
  );
}
