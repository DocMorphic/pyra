"use client";

import { useTheme } from "@/hooks/use-theme";

/**
 * Pyra wallpaper — PostHog cream canvas with a faint dot grid and a
 * subtle warm glow rising from the lower edge (the solar nod).
 */
export function Wallpaper() {
  const { mode } = useTheme();
  const dark = mode === "dark";

  const dot = dark ? "rgba(238,239,233,0.05)" : "rgba(21,21,21,0.05)";

  return (
    <div className="desktop-wallpaper" style={{ background: "var(--color-bg)" }}>
      {/* Dot grid — PostHog-style technical paper */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle at center, ${dot} 1.2px, transparent 1.3px)`,
          backgroundSize: "26px 26px",
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
