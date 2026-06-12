"use client";

import { useTheme } from "@/hooks/use-theme";

/**
 * Pyra wallpaper — PostHog cream canvas with a faint dot grid and a
 * subtle warm glow rising from the lower edge (the solar nod).
 */
export function Wallpaper() {
  const { mode } = useTheme();
  const dark = mode === "dark";

  const line = dark ? "rgba(238,239,233,0.045)" : "rgba(21,21,21,0.045)";

  return (
    <div className="desktop-wallpaper" style={{ background: "var(--color-bg)" }}>
      {/* Faint engineering grid — PostHog technical-paper feel */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />
      {/* Warm sun glow from the bottom-center */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: dark
            ? "radial-gradient(120% 70% at 50% 118%, rgba(255,92,26,0.12) 0%, transparent 58%)"
            : "radial-gradient(120% 70% at 50% 118%, rgba(245,78,0,0.10) 0%, transparent 60%)",
        }}
      />
    </div>
  );
}
