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
  type: "map" | "ledger" | "scope" | "report";
  appId: string;
}

const DESKTOP_ITEMS: DesktopItem[] = [
  { id: "plant-map", label: "Plant Map", type: "map", appId: "plant-map" },
  { id: "loss-ledger", label: "Loss Ledger", type: "ledger", appId: "loss-ledger" },
  { id: "inspector", label: "Inspector", type: "scope", appId: "inspector" },
  { id: "report", label: "Report", type: "report", appId: "report" },
];

const DEFAULT_POSITIONS: Record<string, IconPos> = {
  "plant-map": { x: 24, y: 24 },
  "loss-ledger": { x: 24, y: 124 },
  inspector: { x: 24, y: 224 },
  report: { x: 24, y: 324 },
};

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
  const [positions, setPositions] = useState<Record<string, IconPos>>(DEFAULT_POSITIONS);

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
              <DesktopIconSvg type={item.type} size={48} />
              <span
                className="w-full truncate text-center text-[11.5px]"
                style={{ color: "var(--color-desktop-label)", fontWeight: 500 }}
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
          position={positions[item.id] ?? DEFAULT_POSITIONS[item.id]}
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
      <DesktopIconSvg type={item.type} />
      <span
        className="pointer-events-none text-center text-[11.5px] leading-tight"
        style={{ color: "var(--color-desktop-label)", fontWeight: 500 }}
      >
        {item.label}
      </span>
    </div>
  );
}

function DesktopIconSvg({
  type,
  size = 52,
}: {
  type: "map" | "ledger" | "scope" | "report";
  size?: number;
}) {
  if (type === "map") {
    return (
      <svg width={size} height={size} viewBox="0 0 52 52" fill="none">
        <rect x="6" y="6" width="40" height="40" rx="8" fill="var(--color-accent)" />
        <g stroke="white" strokeWidth="2" strokeLinecap="round">
          <rect x="14" y="14" width="9" height="9" rx="1.5" fill="rgba(255,255,255,0.25)" />
          <rect x="29" y="14" width="9" height="9" rx="1.5" fill="rgba(255,255,255,0.6)" />
          <rect x="14" y="29" width="9" height="9" rx="1.5" fill="rgba(255,255,255,0.45)" />
          <rect x="29" y="29" width="9" height="9" rx="1.5" fill="rgba(255,255,255,0.15)" />
        </g>
      </svg>
    );
  }
  if (type === "ledger") {
    return (
      <svg width={size} height={size} viewBox="0 0 52 52" fill="none">
        <rect x="6" y="6" width="40" height="40" rx="8" fill="var(--color-accent)" />
        <path
          d="M18 16h12a6 6 0 010 12H18M15 22h16M15 28h10M18 16v20"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    );
  }
  if (type === "scope") {
    return (
      <svg width={size} height={size} viewBox="0 0 52 52" fill="none">
        <rect x="6" y="6" width="40" height="40" rx="8" fill="var(--color-accent)" />
        <circle cx="23" cy="23" r="9" stroke="white" strokeWidth="2.2" fill="none" />
        <line x1="30" y1="30" x2="38" y2="38" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M18 24l3-4 2.5 3 2.5-5" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none">
      <path
        d="M14 6 L 32 6 L 40 14 L 40 44 Q 40 46 38 46 L 14 46 Q 12 46 12 44 L 12 8 Q 12 6 14 6 Z"
        fill="var(--color-surface)"
        stroke="var(--color-border-strong)"
        strokeWidth="1"
      />
      <path d="M32 6 L 32 14 L 40 14" stroke="var(--color-border-strong)" strokeWidth="1" fill="none" />
      <path d="M18 22l3-4 2.5 3 2.5-5 3 6" stroke="var(--color-accent)" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="18" y1="34" x2="34" y2="34" stroke="var(--color-text-muted)" strokeWidth="1" />
      <line x1="18" y1="38" x2="28" y2="38" stroke="var(--color-text-muted)" strokeWidth="1" />
    </svg>
  );
}
