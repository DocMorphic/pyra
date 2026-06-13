"use client";

import { useTheme } from "@/hooks/use-theme";
import { SolarFarmScene } from "./SolarFarmScene";

/**
 * Pyra desktop — PostHog-style dark charcoal with a subtle noise texture
 * and a stylized isometric solar-farm scene in the lower-right.
 */
export function Wallpaper() {
  const { mode } = useTheme();
  const dark = mode === "dark";

  // SVG fractal-noise speckle, data-URI'd as a tiling background.
  const noise =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

  return (
    <div
      className="desktop-wallpaper"
      style={{ background: dark ? "#26261f" : "#e7e8e1" }}
    >
      {/* noise texture */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: noise, backgroundSize: "160px 160px", opacity: dark ? 0.5 : 0.35, mixBlendMode: dark ? "overlay" : "multiply" }}
      />
      {/* vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: dark
            ? "radial-gradient(ellipse 80% 70% at 35% 30%, rgba(255,255,255,0.03), transparent 60%), radial-gradient(ellipse at 50% 120%, rgba(0,0,0,0.45), transparent 60%)"
            : "radial-gradient(ellipse at 50% 120%, rgba(0,0,0,0.10), transparent 60%)",
        }}
      />
      <SolarFarmScene />
    </div>
  );
}
