"use client";

/**
 * Pixel-art isometric solar farm — Pyra's take on PostHog's pixel scene.
 * Blocky iso cubes (grass/dirt) with ground-mounted PV panels, hedges, and a
 * pixel sun. Hard edges + limited retro palette for the pixel-art feel.
 */
const TW = 56; // tile width
const TH = 28; // tile height (2:1 iso)
const CH = 18; // cube height

// palette
const GRASS_T = "#5a8a3c";
const GRASS_L = "#3f6a2a";
const GRASS_R = "#33571f";
const DIRT_T = "#7a5631";
const DIRT_L = "#5e4124";
const DIRT_R = "#4d351d";
const HEDGE_T = "#3f6e34";
const HEDGE_L = "#2c4f23";
const HEDGE_R = "#24411c";
const PANEL = "#16263e";
const PANEL_EDGE = "#0e1828";
const CELL = "#2f6fae";
const FRAME = "#aeb4be";

function isoPt(c: number, r: number, ox: number, oy: number): [number, number] {
  return [(c - r) * (TW / 2) + ox, (c + r) * (TH / 2) + oy];
}

function Cube({ c, r, ox, oy, top, left, right, h = CH }: { c: number; r: number; ox: number; oy: number; top: string; left: string; right: string; h?: number }) {
  const [x, y] = isoPt(c, r, ox, oy);
  return (
    <g shapeRendering="crispEdges">
      <polygon points={`${x},${y - TH / 2} ${x + TW / 2},${y} ${x},${y + TH / 2} ${x - TW / 2},${y}`} fill={top} />
      <polygon points={`${x - TW / 2},${y} ${x},${y + TH / 2} ${x},${y + TH / 2 + h} ${x - TW / 2},${y + h}`} fill={left} />
      <polygon points={`${x + TW / 2},${y} ${x},${y + TH / 2} ${x},${y + TH / 2 + h} ${x + TW / 2},${y + h}`} fill={right} />
      {/* pixel dithering on the top face */}
      <rect x={x - 6} y={y - 4} width="3" height="3" fill={left} opacity="0.5" />
      <rect x={x + 5} y={y + 2} width="3" height="3" fill={left} opacity="0.5" />
    </g>
  );
}

function PanelOnTile({ c, r, ox, oy }: { c: number; r: number; ox: number; oy: number }) {
  const [x, yTile] = isoPt(c, r, ox, oy);
  const y = yTile - 12; // raised on legs
  const pw = TW - 14;
  const ph = TH - 7;
  // legs
  const legs = (
    <g shapeRendering="crispEdges">
      <rect x={x - 2} y={y + ph / 2} width="3" height="12" fill="#2a2a2a" />
      <rect x={x - pw / 2 + 4} y={y + 2} width="3" height="12" fill="#2a2a2a" />
      <rect x={x + pw / 2 - 7} y={y + 2} width="3" height="12" fill="#2a2a2a" />
    </g>
  );
  const top = `${x},${y - ph / 2}`;
  const right = `${x + pw / 2},${y}`;
  const bottom = `${x},${y + ph / 2}`;
  const left = `${x - pw / 2},${y}`;
  // pixel cells: 3 columns of cyan cells split by frame lines
  const cells = [];
  for (let i = 0; i < 3; i++) {
    const t0 = i / 3, t1 = (i + 1) / 3;
    const a = [x - pw / 2 + (pw / 2) * t0, y - (ph / 2) * t0];
    const b = [x - pw / 2 + (pw / 2) * t1, y - (ph / 2) * t1];
    const cC = [b[0] - (pw / 2), b[1] + (ph / 2)];
    const d = [a[0] - (pw / 2), a[1] + (ph / 2)];
    cells.push(<polygon key={i} points={`${a} ${b} ${cC} ${d}`} fill={i % 2 ? CELL : "#3a82c4"} />);
  }
  return (
    <g shapeRendering="crispEdges">
      {legs}
      <polygon points={`${top} ${right} ${bottom} ${left}`} fill={PANEL} stroke={PANEL_EDGE} strokeWidth="2" />
      {cells}
      <polygon points={`${top} ${right} ${bottom} ${left}`} fill="none" stroke={FRAME} strokeWidth="1.5" />
    </g>
  );
}

function PixelSun({ x, y }: { x: number; y: number }) {
  const rays = Array.from({ length: 8 });
  return (
    <g shapeRendering="crispEdges">
      {rays.map((_, i) => {
        const a = (i * 45 * Math.PI) / 180;
        return <rect key={i} x={x + Math.cos(a) * 26 - 2} y={y + Math.sin(a) * 26 - 2} width="5" height="5" fill="#f7a501" />;
      })}
      <rect x={x - 14} y={y - 14} width="28" height="28" fill="#f7a501" />
      <rect x={x - 18} y={y - 10} width="36" height="20" fill="#f7a501" />
      <rect x={x - 10} y={y - 18} width="20" height="36" fill="#f7a501" />
      <rect x={x - 8} y={y - 8} width="16" height="16" fill="#ffd699" />
    </g>
  );
}

export function SolarFarmScene() {
  // farm plot: 5x4 grass, panels on inner tiles, hedges on the back row
  const ox = 0, oy = 0;
  const grass: [number, number][] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) grass.push([c, r]);
  const panels: [number, number][] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) panels.push([c + 0.5, r + 0.5]);

  return (
    <svg
      className="pointer-events-none absolute"
      style={{ right: "1%", bottom: "3%", width: 620, height: 480, opacity: 0.97, imageRendering: "pixelated" }}
      viewBox="-220 -120 460 380"
      aria-hidden
    >
      <defs>
        <radialGradient id="farm-glow2" cx="22%" cy="8%" r="70%">
          <stop offset="0%" stopColor="#f7a501" stopOpacity="0.16" />
          <stop offset="60%" stopColor="#f54e00" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#f54e00" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="-220" y="-120" width="460" height="380" fill="url(#farm-glow2)" />
      <PixelSun x={-150} y={-70} />

      {/* ground cubes (painter's order: back to front by c+r) */}
      {grass
        .slice()
        .sort((a, b) => a[0] + a[1] - (b[0] + b[1]))
        .map(([c, r], i) => {
          const isHedge = r === 0; // back row = hedges
          const isPath = c === 2 && r > 0; // a dirt path down the middle
          return (
            <Cube
              key={`g${i}`}
              c={c}
              r={r}
              ox={ox}
              oy={oy}
              h={isHedge ? CH + 16 : CH}
              top={isHedge ? HEDGE_T : isPath ? DIRT_T : GRASS_T}
              left={isHedge ? HEDGE_L : isPath ? DIRT_L : GRASS_L}
              right={isHedge ? HEDGE_R : isPath ? DIRT_R : GRASS_R}
            />
          );
        })}

      {/* panels on top, also back-to-front */}
      {panels
        .slice()
        .sort((a, b) => a[0] + a[1] - (b[0] + b[1]))
        .map(([c, r], i) =>
          c === 2.5 ? null : <PanelOnTile key={`p${i}`} c={c} r={r} ox={ox} oy={oy} />
        )}
    </svg>
  );
}
