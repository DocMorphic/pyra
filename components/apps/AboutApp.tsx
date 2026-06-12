"use client";

import { Sunny } from "@/components/ui/Sunny";
import { Sticker } from "./_shared";

export function AboutApp() {
  return (
    <div className="custom-scrollbar flex h-full flex-col items-center overflow-y-auto px-6 py-5 text-center">
      <Sunny size={84} />

      <h1 className="font-display mt-3 text-[26px] font-bold" style={{ color: "var(--color-text)" }}>
        Pyra
      </h1>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.18em]" style={{ color: "var(--color-text-muted)" }}>
        Solar Plant Intelligence
      </p>

      <div className="mt-3">
        <Sticker color="var(--color-teal)">powered by photons ☀</Sticker>
      </div>

      <p className="mt-5 max-w-[420px] text-[12.5px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
        Hi, I&apos;m <strong>Sunny</strong> — half hedgehog, half sunbeam, fully obsessed with
        solar inverters. I learn what each inverter&apos;s power <em>should</em> look like from
        its first healthy year, then watch a decade of real data for the moment it starts
        slacking.
      </p>
      <p className="mt-3 max-w-[420px] text-[12.5px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
        Performance Ratio tells you a plant is underperforming. Pyra tells you{" "}
        <strong>which inverter</strong>, <strong>since when</strong>, <strong>why</strong>, and{" "}
        <strong>how many euros</strong> it&apos;s quietly costing you — then hands it to your O&amp;M
        team as an action.
      </p>

      <hr className="ph-divider w-full max-w-[420px]" />

      <p className="max-w-[420px] text-[11.5px] leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        Every number is cross-checked against an independent physics model, validated on held-out
        data with confidence intervals, and reconciled against the plant&apos;s own grid meter. No
        hand-waving. (Okay, a little hand-waving — I have tiny paws.)
      </p>

      <div className="mt-auto pt-5 text-[10.5px]" style={{ color: "var(--color-text-dim)" }}>
        Energy × AI Hackathon · EnerParc Digital-Twin challenge
      </div>
    </div>
  );
}
