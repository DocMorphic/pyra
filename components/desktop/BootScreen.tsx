"use client";

import { useEffect, useState } from "react";
import { Sunny } from "@/components/ui/Sunny";

const TOTAL_DURATION_MS = 1900;
const FADE_OUT_DELAY_MS = 1550;

/**
 * Boot screen — Sunny the solar hedgehog pops in on a cream canvas with a
 * playful tagline. Inline SVG mascot, no external assets.
 */
export function BootScreen() {
  const [unmounted, setUnmounted] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFadeOut(true), FADE_OUT_DELAY_MS);
    const t2 = setTimeout(() => setUnmounted(true), TOTAL_DURATION_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (unmounted) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: "#1d1f23",
        opacity: fadeOut ? 0 : 1,
        transition: "opacity 0.35s ease-in",
        pointerEvents: fadeOut ? "none" : "auto",
      }}
      aria-live="polite"
      aria-label="Starting Pyra"
    >
      <div className="flex flex-col items-center gap-4">
        <div style={{ animation: "sunny-pop 0.6s cubic-bezier(0.22,1.4,0.5,1) both" }}>
          <Sunny size={120} />
        </div>
        <div
          className="flex flex-col items-center gap-1"
          style={{ opacity: 0, animation: "wordmark-in 0.5s ease-out 0.5s forwards" }}
        >
          <div className="font-display text-[34px]" style={{ color: "#eeefe9", fontWeight: 700, letterSpacing: "-0.02em" }}>
            Pyra
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: "#9698a0" }}>
            Counting photons…
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes sunny-pop {
          from { opacity: 0; transform: translateY(16px) scale(0.8); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes wordmark-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
