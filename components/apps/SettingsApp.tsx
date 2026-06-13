"use client";

import { useTheme, type AccentColor } from "@/hooks/use-theme";
import { useWindowManager } from "@/hooks/use-window-manager";
import { STORAGE_PREFIX } from "@/lib/constants";

const ACCENTS: { value: AccentColor; swatch: string; label: string }[] = [
  { value: "red", swatch: "#f54e00", label: "Solar red" },
  { value: "blue", swatch: "#2f80fa", label: "Blue" },
  { value: "yellow", swatch: "#f7a501", label: "Yellow" },
];

const SHORTCUTS: [string, string][] = [
  ["Close focused window", "Esc"],
  ["Close / Maximize", "⌘/Ctrl + Alt + W / F"],
  ["Minimize / Center", "⌘/Ctrl + Alt + M / C"],
  ["Refresh", "⌘/Ctrl + R"],
];

function resetSystem() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(`${STORAGE_PREFIX}:`))
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
  window.location.reload();
}

export function SettingsApp() {
  const { mode, setMode, accent, setAccent, brightness, setBrightness, companion, setCompanion } = useTheme();
  const { openWindow } = useWindowManager();

  return (
    <div className="custom-scrollbar h-full space-y-4 overflow-y-auto overflow-x-hidden">
      <Row label="Theme">
        <Toggle
          options={[{ v: "light", l: "☀ Day" }, { v: "dark", l: "☾ Night" }]}
          value={mode}
          onChange={(v) => setMode(v as "light" | "dark")}
        />
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
                border: accent === a.value ? "2px solid var(--color-text)" : "1px solid var(--color-border)",
                transform: accent === a.value ? "scale(1.08)" : "scale(1)",
              }}
            />
          ))}
        </div>
      </Row>

      <Row label="Brightness">
        <div className="w-full">
          <input
            type="range" min={70} max={100} value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="w-full" style={{ accentColor: "var(--color-accent)" }}
          />
          <div className="mt-0.5 text-right text-[11px]" style={{ color: "var(--color-text-muted)" }}>{brightness}%</div>
        </div>
      </Row>

      <Row label="Desktop companion">
        <Toggle
          options={[{ v: "on", l: "Sunny" }, { v: "off", l: "Off" }]}
          value={companion ? "on" : "off"}
          onChange={(v) => setCompanion(v === "on")}
        />
      </Row>

      <hr className="ph-divider" />

      <div>
        <div className="ph-label mb-1.5">Keyboard shortcuts</div>
        <div className="space-y-1">
          {SHORTCUTS.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-[12px]">
              <span style={{ color: "var(--color-text-secondary)" }}>{k}</span>
              <kbd className="font-mono rounded px-1.5 py-0.5 text-[10.5px]" style={{ background: "var(--color-info-box)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>{v}</kbd>
            </div>
          ))}
        </div>
      </div>

      <hr className="ph-divider" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1 text-[11.5px]" style={{ color: "var(--color-text-muted)" }}>
          Pyra v0.1 · Energy × AI Hackathon · EnerParc
        </div>
        <div className="flex shrink-0 gap-2">
          <button className="ph-btn secondary text-[12px]" onClick={() => openWindow("about")}>About</button>
          <button className="ph-btn red text-[12px]" onClick={resetSystem}>Reset PyraOS</button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ options, value, onChange }: { options: { v: string; l: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex overflow-hidden border" style={{ borderColor: "var(--color-border)", borderRadius: 6 }}>
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className="px-4 py-1.5 text-[12px] transition-colors"
          style={{
            background: value === o.v ? "var(--color-accent)" : "transparent",
            color: value === o.v ? "#fff" : "var(--color-text)",
            fontWeight: value === o.v ? 600 : 400,
          }}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[12.5px] font-medium" style={{ color: "var(--color-text)" }}>{label}</span>
      <div className="flex min-w-[180px] justify-end">{children}</div>
    </div>
  );
}
