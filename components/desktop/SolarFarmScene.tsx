"use client";

import { Sunny } from "@/components/ui/Sunny";

/**
 * Stylized isometric solar farm — Pyra's answer to PostHog's garden scene.
 * Rows of tilted PV panels (iso rhombi with a cell grid) on dark ground,
 * Sunny tending them, a warm glow. Inline SVG, ambient (low opacity).
 */
const TW = 86; // iso tile width
const TH = 43; // iso tile height (2:1)

function iso(col: number, row: number): [number, number] {
  return [(col - row) * (TW / 2), (col + row) * (TH / 2)];
}

function Panel({ col, row }: { col: number; row: number }) {
  const [x, y] = iso(col, row);
  // top rhombus corners
  const top = `${x},${y - TH / 2}`;
  const right = `${x + TW / 2},${y}`;
  const bottom = `${x},${y + TH / 2}`;
  const left = `${x - TW / 2},${y}`;
  // 3x2 cell grid lines interpolated across the rhombus
  const lines: string[] = [];
  for (let i = 1; i < 3; i++) {
    const t = i / 3;
    lines.push(`M ${x - TW / 2 + (TW / 2) * t},${y - (TH / 2) * t} L ${x + (TW / 2) * t},${y + TH / 2 - (TH / 2) * t}`);
  }
  for (let i = 1; i < 2; i++) {
    const t = i / 2;
    lines.push(`M ${x - TW / 2 + (TW / 2) * t},${y + (TH / 2) * t} L ${x + (TW / 2) * t},${y - TH / 2 + (TH / 2) * t}`);
  }
  return (
    <g>
      {/* support leg shadow */}
      <line x1={x} y1={y} x2={x} y2={y + 16} stroke="#0c1016" strokeWidth="3" />
      {/* panel face */}
      <polygon points={`${top} ${right} ${bottom} ${left}`} fill="#163a5e" stroke="#2f80fa" strokeWidth="1.2" />
      {lines.map((d, i) => (
        <path key={i} d={d} stroke="#2f80fa" strokeWidth="0.8" opacity="0.55" />
      ))}
      {/* sun glint */}
      <polygon points={`${left} ${top} ${x - TW / 6},${y - TH / 6}`} fill="#2f80fa" opacity="0.25" />
    </g>
  );
}

export function SolarFarmScene() {
  const panels: { col: number; row: number }[] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) panels.push({ col: c, row: r });

  return (
    <svg
      className="pointer-events-none absolute"
      style={{ right: "2%", bottom: "4%", width: 560, height: 460, opacity: 0.9 }}
      viewBox="-260 -120 520 420"
      aria-hidden
    >
      <defs>
        <radialGradient id="farm-glow" cx="50%" cy="0%" r="80%">
          <stop offset="0%" stopColor="#f7a501" stopOpacity="0.18" />
          <stop offset="55%" stopColor="#f54e00" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#f54e00" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="-260" y="-120" width="520" height="420" fill="url(#farm-glow)" />
      {/* ground patch */}
      <polygon points="0,-30 230,85 0,200 -230,85" fill="#22251f" opacity="0.6" />
      {panels.map((p, i) => (
        <Panel key={i} {...p} />
      ))}
      {/* Sunny tending the farm, front-left */}
      <g transform="translate(-150, 120)">
        <Sunny size={66} />
      </g>
    </svg>
  );
}
