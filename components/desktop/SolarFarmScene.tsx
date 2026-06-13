"use client";

/**
 * Pixel-art isometric solar farm. A clean rectangular plot of iso cubes with
 * ground-mounted PV panels and back hedges, grounded by a soft shadow and
 * faded at the edges so it sits in the desktop rather than floating on it.
 */
const TW = 54;
const TH = 27;
const CH = 16;

// muted palette (kept dark so it blends into the charcoal desktop)
const GRASS_T = "#48703a";
const GRASS_L = "#33532a";
const GRASS_R = "#294421";
const HEDGE_T = "#3a6231";
const HEDGE_L = "#284621";
const HEDGE_R = "#1f3a1a";
const PANEL = "#16263e";
const PANEL_EDGE = "#0e1828";
const CELL_A = "#2f6fae";
const CELL_B = "#26588c";
const FRAME = "#8b929c";

function isoPt(c: number, r: number): [number, number] {
  return [(c - r) * (TW / 2), (c + r) * (TH / 2)];
}

function Cube({ c, r, top, left, right, h = CH }: { c: number; r: number; top: string; left: string; right: string; h?: number }) {
  const [x, y] = isoPt(c, r);
  return (
    <g shapeRendering="crispEdges">
      <polygon points={`${x},${y - TH / 2} ${x + TW / 2},${y} ${x},${y + TH / 2} ${x - TW / 2},${y}`} fill={top} />
      <polygon points={`${x - TW / 2},${y} ${x},${y + TH / 2} ${x},${y + TH / 2 + h} ${x - TW / 2},${y + h}`} fill={left} />
      <polygon points={`${x + TW / 2},${y} ${x},${y + TH / 2} ${x},${y + TH / 2 + h} ${x + TW / 2},${y + h}`} fill={right} />
      <rect x={x - 7} y={y - 3} width="3" height="3" fill={left} opacity="0.5" />
      <rect x={x + 6} y={y + 3} width="3" height="3" fill={left} opacity="0.5" />
    </g>
  );
}

function Panel({ c, r }: { c: number; r: number }) {
  const [x, yTile] = isoPt(c, r);
  const y = yTile - 11;
  const pw = TW - 16;
  const ph = TH - 8;
  const top = `${x},${y - ph / 2}`;
  const right = `${x + pw / 2},${y}`;
  const bottom = `${x},${y + ph / 2}`;
  const left = `${x - pw / 2},${y}`;
  const cells = [];
  for (let i = 0; i < 3; i++) {
    const t0 = i / 3, t1 = (i + 1) / 3;
    const a = [x - pw / 2 + (pw / 2) * t0, y - (ph / 2) * t0];
    const b = [x - pw / 2 + (pw / 2) * t1, y - (ph / 2) * t1];
    const cc = [b[0] - pw / 2, b[1] + ph / 2];
    const d = [a[0] - pw / 2, a[1] + ph / 2];
    cells.push(<polygon key={i} points={`${a} ${b} ${cc} ${d}`} fill={i % 2 ? CELL_A : CELL_B} />);
  }
  return (
    <g shapeRendering="crispEdges">
      <rect x={x - 1.5} y={y + ph / 2} width="3" height="11" fill="#222" />
      <rect x={x - pw / 2 + 4} y={y + 1} width="3" height="11" fill="#222" />
      <rect x={x + pw / 2 - 7} y={y + 1} width="3" height="11" fill="#222" />
      <polygon points={`${top} ${right} ${bottom} ${left}`} fill={PANEL} stroke={PANEL_EDGE} strokeWidth="2" />
      {cells}
      <polygon points={`${top} ${right} ${bottom} ${left}`} fill="none" stroke={FRAME} strokeWidth="1.3" />
    </g>
  );
}

export function SolarFarmScene() {
  const COLS = 5, ROWS = 4;
  const ground: [number, number][] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) ground.push([c, r]);

  // one panel centered on every non-hedge grass tile → tidy, no overhang
  const panels: [number, number][] = [];
  for (let r = 1; r < ROWS; r++) for (let c = 0; c < COLS; c++) panels.push([c, r]);

  return (
    <svg
      className="pointer-events-none absolute"
      style={{ right: "2%", bottom: "5%", width: 640, height: 520, opacity: 0.95, imageRendering: "pixelated" }}
      viewBox="-200 -150 400 360"
      aria-hidden
    >
      <defs>
        <radialGradient id="farm-glow2" cx="20%" cy="6%" r="75%">
          <stop offset="0%" stopColor="#f7a501" stopOpacity="0.13" />
          <stop offset="55%" stopColor="#f54e00" stopOpacity="0.03" />
          <stop offset="100%" stopColor="#f54e00" stopOpacity="0" />
        </radialGradient>
        {/* fade the scene edges so the slab doesn't read as a pasted rectangle */}
        <radialGradient id="farm-fade" cx="50%" cy="50%" r="62%">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="78%" stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="farm-mask">
          <rect x="-200" y="-150" width="400" height="360" fill="url(#farm-fade)" />
        </mask>
        <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>

      <rect x="-200" y="-150" width="400" height="360" fill="url(#farm-glow2)" />

      <g mask="url(#farm-mask)">
        {/* grounding shadow under the slab */}
        <ellipse cx="0" cy="120" rx="155" ry="46" fill="#000" opacity="0.4" filter="url(#soft)" />

        {/* ground (back-to-front) */}
        {ground
          .slice()
          .sort((a, b) => a[0] + a[1] - (b[0] + b[1]))
          .map(([c, r], i) => {
            const hedge = r === 0;
            return (
              <Cube
                key={`g${i}`}
                c={c}
                r={r}
                h={hedge ? CH + 14 : CH}
                top={hedge ? HEDGE_T : GRASS_T}
                left={hedge ? HEDGE_L : GRASS_L}
                right={hedge ? HEDGE_R : GRASS_R}
              />
            );
          })}

        {/* panels (back-to-front) */}
        {panels
          .slice()
          .sort((a, b) => a[0] + a[1] - (b[0] + b[1]))
          .map(([c, r], i) => (
            <Panel key={`p${i}`} c={c} r={r} />
          ))}
      </g>
    </svg>
  );
}
