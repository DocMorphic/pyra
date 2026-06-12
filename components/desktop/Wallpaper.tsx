"use client";

import { useTheme } from "@/hooks/use-theme";

/**
 * Pyra wallpaper — a solar horizon. A warm sun-glow rises from the
 * lower edge over a deep night-blue field (or a pale sky in day mode),
 * with a faint inverter-grid pattern so the desktop reads as a plant.
 */
export function Wallpaper() {
  const { mode } = useTheme();
  const dark = mode === "dark";

  const lineColor = dark ? "rgba(141, 162, 192, 0.05)" : "rgba(15, 23, 42, 0.04)";

  return (
    <div className="desktop-wallpaper" style={{ background: "var(--color-bg)" }}>
      {/* Base vertical wash — darker at top, warmer toward the horizon */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: dark
            ? "linear-gradient(180deg, #050810 0%, #070b16 45%, #0c1322 100%)"
            : "linear-gradient(180deg, #e4ecf6 0%, #eef2f8 55%, #f3f1ea 100%)",
        }}
      />
      {/* Sun glow rising from bottom-center */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: dark
            ? "radial-gradient(120% 80% at 50% 118%, rgba(251,191,36,0.22) 0%, rgba(245,158,11,0.10) 28%, transparent 60%)"
            : "radial-gradient(120% 80% at 50% 118%, rgba(245,158,11,0.20) 0%, rgba(251,191,36,0.10) 30%, transparent 62%)",
        }}
      />
      {/* Faint grid — rows of inverters / module strings */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(${lineColor} 1px, transparent 1px), linear-gradient(90deg, ${lineColor} 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse 90% 70% at 50% 35%, black 40%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 90% 70% at 50% 35%, black 40%, transparent 100%)",
        }}
      />
    </div>
  );
}
