"use client";

import { Sunny } from "@/components/ui/Sunny";
import { Sticker } from "./_shared";
import { useWindowManager } from "@/hooks/use-window-manager";

const LAUNCH: { id: string; label: string }[] = [
  { id: "plant-map", label: "Plant Map" },
  { id: "loss-ledger", label: "Loss Ledger" },
  { id: "methods", label: "Methods" },
  { id: "copilot", label: "Ask Sunny" },
];

export function AboutApp() {
  const { openWindow, focusWindow } = useWindowManager();
  const go = (id: string) => {
    openWindow(id);
    focusWindow(id);
  };

  return (
    <div className="custom-scrollbar flex h-full flex-col items-center overflow-y-auto px-6 py-5 text-center">
      <Sunny size={88} />

      <h1 className="font-display mt-3 text-[28px] font-bold" style={{ color: "var(--color-text)" }}>
        Welcome to Pyra
      </h1>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.18em]" style={{ color: "var(--color-text-muted)" }}>
        Solar Plant Intelligence
      </p>

      <div className="mt-3">
        <Sticker color="var(--color-teal)">powered by photons ☀</Sticker>
      </div>

      <p className="mt-5 max-w-[440px] text-[12.5px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
        Hi, I&apos;m <strong>Sunny</strong> — half hedgehog, half sunbeam. I learn what each inverter&apos;s
        power <em>should</em> look like from its first healthy year, then watch a decade of real data for
        the moment it starts slacking — and quantify what it costs you.
      </p>

      {/* launch buttons */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {LAUNCH.map((l, i) => (
          <button key={l.id} className={`ph-btn text-[12.5px] ${i === 0 ? "" : "secondary"}`} onClick={() => go(l.id)}>
            {l.label}
          </button>
        ))}
      </div>

      <hr className="ph-divider w-full max-w-[440px]" />

      <p className="max-w-[440px] text-[11.5px] leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        Every number is cross-checked against an independent physics model, validated on held-out data
        with confidence intervals, and reconciled against the plant&apos;s own grid meter. No hand-waving.
        (Okay, a little — I have tiny paws.)
      </p>

      <div className="mt-auto pt-5 text-[10.5px]" style={{ color: "var(--color-text-dim)" }}>
        Energy × AI Hackathon · EnerParc Digital-Twin challenge
      </div>
    </div>
  );
}
