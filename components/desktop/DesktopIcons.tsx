"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWindowManager } from "@/hooks/use-window-manager";

const MOBILE_BREAKPOINT = 768;
const ICON_WIDTH = 92;
const ICON_HEIGHT = 88;
const DRAG_THRESHOLD_PX = 6;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

interface IconPos {
  x: number;
  y: number;
}

interface DesktopItem {
  id: string;
  label: string;
  accent: string;
  appId: string;
  side: "left" | "right";
}

const DESKTOP_ITEMS: DesktopItem[] = [
  { id: "plant-map", label: "plant-map.svg", accent: "#f54e00", appId: "plant-map", side: "left" },
  { id: "loss-ledger", label: "loss-ledger.csv", accent: "#f7a501", appId: "loss-ledger", side: "left" },
  { id: "inspector", label: "inspector.app", accent: "#2f80fa", appId: "inspector", side: "left" },
  { id: "timeline", label: "faults.log", accent: "#f35454", appId: "timeline", side: "left" },
  { id: "simulator", label: "what-if.sim", accent: "#29dbbb", appId: "simulator", side: "left" },
  { id: "fault-econ", label: "fault-econ.xls", accent: "#b62ad9", appId: "fault-econ", side: "left" },
  { id: "risk", label: "fleet-risk.app", accent: "#f54e00", appId: "risk", side: "right" },
  { id: "soiling", label: "soiling-B.dat", accent: "#2f80fa", appId: "soiling", side: "right" },
  { id: "methods", label: "methods.md", accent: "#29dbbb", appId: "methods", side: "right" },
  { id: "copilot", label: "ask-sunny", accent: "#b62ad9", appId: "copilot", side: "right" },
  { id: "report", label: "report.pdf", accent: "#6aa84f", appId: "report", side: "right" },
  { id: "about", label: "about.txt", accent: "#9698a0", appId: "about", side: "right" },
];

function computePositions(): Record<string, IconPos> {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
  const rightX = Math.max(140, vw - 116);
  const pos: Record<string, IconPos> = {};
  let li = 0, ri = 0;
  for (const it of DESKTOP_ITEMS) {
    if (it.side === "left") pos[it.id] = { x: 28, y: 28 + li++ * 100 };
    else pos[it.id] = { x: rightX, y: 28 + ri++ * 100 };
  }
  return pos;
}

function clampPosition(x: number, y: number): IconPos {
  if (typeof window === "undefined") return { x, y };
  const vw = window.innerWidth;
  const contentH = window.innerHeight - 34;
  const dockReserve = 80;
  const minX = 0;
  const maxX = Math.max(minX, vw - ICON_WIDTH);
  const minY = 0;
  const maxY = Math.max(minY, contentH - ICON_HEIGHT - dockReserve);
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

export function DesktopIcons() {
  const { openWindow } = useWindowManager();
  const isMobile = useIsMobile();
  const [positions, setPositions] = useState<Record<string, IconPos>>(() => computePositions());

  useEffect(() => {
    setPositions(computePositions());
  }, []);

  const handleActivate = useCallback(
    (item: DesktopItem) => openWindow(item.appId),
    [openWindow]
  );

  if (isMobile) {
    return (
      <div
        className="no-scrollbar absolute left-0 right-0 top-0 z-[5] overflow-x-auto overflow-y-hidden"
        style={{ WebkitOverflowScrolling: "touch", maxWidth: "100vw" }}
      >
        <div className="flex w-max items-start gap-2 px-3 py-3">
          {DESKTOP_ITEMS.map((item) => (
            <button
              key={item.id}
              className="flex w-[88px] shrink-0 flex-col items-center gap-1.5 rounded-lg px-1 py-1 select-none"
              onClick={() => handleActivate(item)}
            >
              <DesktopIconSvg accent={item.accent} size={48} />
              <span
                className="font-mono w-full truncate text-center text-[11px]"
                style={{ color: "var(--color-desktop-label)", fontWeight: 500, textDecoration: "underline", textUnderlineOffset: 3 }}
              >
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {DESKTOP_ITEMS.map((item) => (
        <DraggableIcon
          key={item.id}
          item={item}
          position={positions[item.id] ?? { x: 28, y: 28 }}
          onOpen={() => handleActivate(item)}
          onCommit={(x, y) => {
            setPositions((prev) => ({
              ...prev,
              [item.id]: clampPosition(x, y),
            }));
          }}
        />
      ))}
    </>
  );
}

interface DraggableIconProps {
  item: DesktopItem;
  position: IconPos;
  onOpen: () => void;
  onCommit: (x: number, y: number) => void;
}

function DraggableIcon({ item, position, onOpen, onCommit }: DraggableIconProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({
    pointerStartX: 0,
    pointerStartY: 0,
    baseX: 0,
    baseY: 0,
    latestX: 0,
    latestY: 0,
    dragging: false,
    moved: false,
    rafPending: false,
  });

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const s = dragState.current;
      s.pointerStartX = e.clientX;
      s.pointerStartY = e.clientY;
      s.baseX = position.x;
      s.baseY = position.y;
      s.latestX = position.x;
      s.latestY = position.y;
      s.dragging = true;
      s.moved = false;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    },
    [position.x, position.y]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const s = dragState.current;
    if (!s.dragging) return;
    const dx = e.clientX - s.pointerStartX;
    const dy = e.clientY - s.pointerStartY;
    if (!s.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      s.moved = true;
      rootRef.current?.classList.add("dragging");
    }
    s.latestX = s.baseX + dx;
    s.latestY = s.baseY + dy;
    if (!s.rafPending) {
      s.rafPending = true;
      requestAnimationFrame(() => {
        s.rafPending = false;
        const el = rootRef.current;
        if (el) {
          el.style.transform = `translate3d(${s.latestX}px, ${s.latestY}px, 0)`;
        }
      });
    }
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const s = dragState.current;
      if (!s.dragging) return;
      s.dragging = false;
      try {
        if (e.currentTarget && "releasePointerCapture" in e.currentTarget) {
          (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        }
      } catch {}
      rootRef.current?.classList.remove("dragging");
      if (!s.moved) {
        onOpen();
        return;
      }
      onCommit(s.latestX, s.latestY);
    },
    [onCommit, onOpen]
  );

  return (
    <div
      ref={rootRef}
      className="desktop-icon absolute z-10 flex flex-col items-center gap-1 px-2 py-2 select-none"
      style={{
        left: 0,
        top: 0,
        width: ICON_WIDTH,
        cursor: "pointer",
        touchAction: "none",
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <DesktopIconSvg accent={item.accent} />
      <span
        className="font-mono pointer-events-none text-center text-[11px] leading-tight"
        style={{ color: "var(--color-desktop-label)", fontWeight: 500, textDecoration: "underline", textUnderlineOffset: 3 }}
      >
        {item.label}
      </span>
    </div>
  );
}

/** PostHog-style desktop file icon: a document with a colored corner-fold
 *  tab and a small accent glyph. */
function DesktopIconSvg({ accent, size = 52 }: { accent: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none">
      {/* document body */}
      <path
        d="M12 5 L33 5 L43 15 L43 45 Q43 47 41 47 L12 47 Q10 47 10 45 L10 7 Q10 5 12 5 Z"
        fill="#2a2c32"
        stroke="#43454d"
        strokeWidth="1.5"
      />
      {/* folded corner */}
      <path d="M33 5 L33 15 L43 15 Z" fill="#43454d" />
      {/* colored header band */}
      <path d="M12 5 L33 5 L33 13 L10 13 L10 7 Q10 5 12 5 Z" fill={accent} opacity="0.9" />
      {/* accent glyph + lines */}
      <circle cx="18" cy="24" r="3" fill={accent} />
      <line x1="25" y1="24" x2="38" y2="24" stroke="#9698a0" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="16" y1="32" x2="38" y2="32" stroke="#5b5e67" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="16" y1="38" x2="32" y2="38" stroke="#5b5e67" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
