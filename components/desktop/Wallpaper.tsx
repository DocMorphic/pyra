"use client";

import { useTheme } from "@/hooks/use-theme";
import { Sunny } from "@/components/ui/Sunny";

/**
 * Pyra desktop — clean dark charcoal with a subtle noise texture and a
 * friendly Sunny companion sitting in the lower area (toggleable in Settings).
 */
export function Wallpaper() {
  const { mode, companion } = useTheme();
  const dark = mode === "dark";

  const noise =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

  return (
    <div className="desktop-wallpaper" style={{ background: dark ? "#1d1f23" : "#e7e8e1" }}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: noise,
          backgroundSize: "160px 160px",
          opacity: dark ? 0.45 : 0.32,
          mixBlendMode: dark ? "overlay" : "multiply",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: dark
            ? "radial-gradient(ellipse 70% 60% at 50% 38%, rgba(255,255,255,0.025), transparent 60%), radial-gradient(ellipse at 50% 118%, rgba(0,0,0,0.4), transparent 55%)"
            : "radial-gradient(ellipse at 50% 118%, rgba(0,0,0,0.08), transparent 55%)",
        }}
      />
      {companion && (
        <div
          className="pointer-events-none absolute"
          style={{ left: "50%", bottom: "12%", transform: "translateX(-50%)" }}
        >
          {/* soft warm glow behind Sunny */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              width: 360,
              height: 360,
              background: "radial-gradient(circle, rgba(247,165,1,0.10), transparent 62%)",
            }}
          />
          <div style={{ opacity: 0.92 }}>
            <Sunny size={150} />
          </div>
        </div>
      )}
    </div>
  );
}
