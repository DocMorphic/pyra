"use client";

import { useTheme, type AccentColor } from "@/hooks/use-theme";
import { useWindowManager } from "@/hooks/use-window-manager";

interface BrightnessPopoverProps {
  onClose: () => void;
}

const ACCENTS: { value: AccentColor; swatch: string; label: string }[] = [
  { value: "red", swatch: "#f54e00", label: "Solar red" },
  { value: "blue", swatch: "#1d4aff", label: "Blue" },
  { value: "yellow", swatch: "#dc9300", label: "Yellow" },
];

export function BrightnessPopover({ onClose }: BrightnessPopoverProps) {
  const { brightness, setBrightness, mode, setMode, accent, setAccent } = useTheme();
  const { openWindow } = useWindowManager();

  return (
    <div
      className="menu-dropdown absolute right-0 top-full mt-1 w-[260px] border p-3"
      style={{
        background: "var(--color-surface-solid)",
        borderColor: "var(--color-border)",
        borderRadius: 8,
        boxShadow: "0 8px 24px var(--color-window-shadow)",
      }}
    >
      <div
        className="mb-2 text-[10px] font-semibold tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        DISPLAY
      </div>

      <div className="mb-3">
        <div className="mb-1.5 text-[12px]" style={{ color: "var(--color-text)" }}>
          Brightness
        </div>
        <input
          type="range"
          min={70}
          max={100}
          value={brightness}
          onChange={(e) => setBrightness(Number(e.target.value))}
          className="w-full"
          style={{ accentColor: "var(--color-accent)" }}
        />
        <div
          className="mt-1 flex justify-between text-[10px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span>Dim</span>
          <span>{brightness}%</span>
          <span>Bright</span>
        </div>
      </div>

      <div className="mb-3">
        <div className="mb-1.5 text-[12px]" style={{ color: "var(--color-text)" }}>
          Theme
        </div>
        <div
          className="flex overflow-hidden border"
          style={{ borderColor: "var(--color-border)", borderRadius: 6 }}
        >
          {(["light", "dark"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex-1 py-1.5 text-[11.5px] transition-colors"
              style={{
                background: mode === m ? "var(--color-accent)" : "transparent",
                color: mode === m ? "white" : "var(--color-text)",
                fontWeight: mode === m ? 500 : 400,
              }}
            >
              {m === "light" ? "☀ Light" : "☾ Dark"}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-2">
        <div className="mb-1.5 text-[12px]" style={{ color: "var(--color-text)" }}>
          Accent
        </div>
        <div className="flex gap-1.5">
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              onClick={() => setAccent(a.value)}
              title={a.label}
              aria-label={a.label}
              className="h-6 w-6 transition-transform"
              style={{
                background: a.swatch,
                borderRadius: "50%",
                border:
                  accent === a.value
                    ? "2px solid var(--color-text)"
                    : "1px solid var(--color-border)",
                transform: accent === a.value ? "scale(1.05)" : "scale(1)",
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      </div>

      <div className="my-2 h-px" style={{ background: "var(--color-border)" }} />

      <button
        className="w-full rounded px-2 py-1.5 text-left text-[12px] transition-colors"
        style={{ color: "var(--color-text)" }}
        onClick={() => {
          openWindow("settings");
          onClose();
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--color-surface-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        Open all settings…
      </button>
    </div>
  );
}
