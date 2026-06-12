"use client";

import { useEffect, useState } from "react";

const TOTAL_DURATION_MS = 1900;
const FADE_OUT_DELAY_MS = 1550;

/**
 * Boot screen — a sun rising over the horizon.
 *
 * Visual story (~1.9s):
 *   1. Deep night background fades in instantly.
 *   2. A sun disc rises from the horizon line, its rays extending.
 *   3. A warm glow blooms behind it.
 *   4. The Pyra wordmark fades in beneath.
 *   5. Whole screen fades out.
 *
 * Inline SVG only — no external assets, no FOUC. Unmounts after fade.
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
        background: "#050810",
        opacity: fadeOut ? 0 : 1,
        transition: "opacity 0.35s ease-in",
        pointerEvents: fadeOut ? "none" : "auto",
      }}
      aria-live="polite"
      aria-label="Starting PyraOS"
    >
      <div className="flex flex-col items-center gap-6">
        <svg width="200" height="150" viewBox="0 0 200 150" fill="none" aria-hidden>
          <defs>
            <radialGradient id="pyra-glow" cx="50%" cy="100%" r="75%">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.55" />
              <stop offset="40%" stopColor="#f59e0b" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>
            <clipPath id="pyra-horizon">
              <rect x="0" y="0" width="200" height="112" />
            </clipPath>
          </defs>

          {/* Warm glow blooming from the horizon */}
          <rect
            x="0"
            y="0"
            width="200"
            height="150"
            fill="url(#pyra-glow)"
            style={{ opacity: 0, animation: "glow-in 0.9s ease-out 0.5s forwards" }}
          />

          {/* Sun + rays, clipped to above the horizon, rising up */}
          <g clipPath="url(#pyra-horizon)">
            <g style={{ animation: "sun-rise 1s cubic-bezier(0.22,1,0.36,1) 0.2s both" }}>
              <circle cx="100" cy="112" r="22" fill="#fbbf24" />
              <circle cx="100" cy="112" r="22" fill="none" stroke="#fde68a" strokeWidth="1.5" opacity="0.6" />
              <g stroke="#fbbf24" strokeWidth="2.4" strokeLinecap="round">
                {Array.from({ length: 12 }).map((_, i) => {
                  const a = (i * 30 * Math.PI) / 180;
                  const r1 = 28;
                  const r2 = 38;
                  return (
                    <line
                      key={i}
                      x1={100 + r1 * Math.cos(a)}
                      y1={112 + r1 * Math.sin(a)}
                      x2={100 + r2 * Math.cos(a)}
                      y2={112 + r2 * Math.sin(a)}
                      style={{ opacity: 0, animation: `ray-in 0.5s ease-out ${0.9 + i * 0.03}s forwards` }}
                    />
                  );
                })}
              </g>
            </g>
          </g>

          {/* Horizon line */}
          <line
            x1="18"
            y1="112"
            x2="182"
            y2="112"
            stroke="#33415c"
            strokeWidth="1.5"
            style={{
              strokeDasharray: 164,
              strokeDashoffset: 164,
              animation: "draw 0.5s ease-out 0.3s forwards",
            }}
          />
        </svg>

        <div
          className="flex flex-col items-center gap-1.5"
          style={{ opacity: 0, animation: "wordmark-in 0.5s ease-out 1.15s forwards" }}
        >
          <div
            className="font-display text-[32px]"
            style={{ color: "#fef3c7", fontWeight: 600, letterSpacing: "0.02em" }}
          >
            Pyra
          </div>
          <div
            className="text-[10.5px] uppercase tracking-[0.22em]"
            style={{ color: "#8da2c0" }}
          >
            Solar Plant Intelligence
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes sun-rise {
          from { transform: translateY(46px); }
          to { transform: translateY(0); }
        }
        @keyframes ray-in {
          to { opacity: 0.9; }
        }
        @keyframes glow-in {
          to { opacity: 1; }
        }
        @keyframes wordmark-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
