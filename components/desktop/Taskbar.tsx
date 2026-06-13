"use client";

import { useEffect, useState } from "react";
import { useWindowManager } from "@/hooks/use-window-manager";
import { APP_REGISTRY } from "@/lib/constants";

const DOCK_APPS_ORDER = [
  "plant-map",
  "loss-ledger",
  "inspector",
  "timeline",
  "simulator",
  "fault-econ",
  "risk",
  "soiling",
  "add-dataset",
  "copilot",
  "methods",
  "report",
  "settings",
];

const DOCK_APPS = DOCK_APPS_ORDER.map((id) => APP_REGISTRY[id]).filter(Boolean);

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

const ICON_STROKE = "currentColor";
const ICON_PROPS = {
  fill: "none" as const,
  stroke: ICON_STROKE,
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const DOCK_ICONS: Record<string, React.ReactNode> = {
  "plant-map": (
    <svg width="20" height="20" viewBox="0 0 24 24" {...ICON_PROPS}>
      <rect x="3" y="4" width="7" height="7" rx="1" />
      <rect x="14" y="4" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  "loss-ledger": (
    <svg width="20" height="20" viewBox="0 0 24 24" {...ICON_PROPS}>
      <path d="M7 5h8a4 4 0 010 8H7M5 9h9M5 13h6" />
      <path d="M7 5v14" />
    </svg>
  ),
  inspector: (
    <svg width="20" height="20" viewBox="0 0 24 24" {...ICON_PROPS}>
      <circle cx="11" cy="11" r="6" />
      <line x1="16" y1="16" x2="20" y2="20" />
      <path d="M8.5 12l2-2.5 1.5 2 1.5-3" />
    </svg>
  ),
  timeline: (
    <svg width="20" height="20" viewBox="0 0 24 24" {...ICON_PROPS}>
      <path d="M3 20V4M3 20h18" />
      <path d="M6 15l4-5 3 3 5-7" />
    </svg>
  ),
  copilot: (
    <svg width="20" height="20" viewBox="0 0 24 24" {...ICON_PROPS}>
      <rect x="4" y="7" width="16" height="11" rx="3" />
      <path d="M12 4v3M9 12h.01M15 12h.01" />
    </svg>
  ),
  report: (
    <svg width="20" height="20" viewBox="0 0 24 24" {...ICON_PROPS}>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" {...ICON_PROPS}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.5 1.5M16.9 16.9l1.5 1.5M5.6 18.4l1.5-1.5M16.9 7.1l1.5-1.5" />
    </svg>
  ),
};

export function Taskbar() {
  const { windows, openWindow, focusWindow, restoreWindow, minimizeWindow } = useWindowManager();
  const isMobile = useIsMobile();

  return (
    <div
      className="absolute bottom-3 left-1/2 z-[600] -translate-x-1/2"
      style={{ pointerEvents: "auto" }}
    >
      <div
        className="flex items-center justify-center gap-1 border px-2 py-1.5"
        style={{
          background: "var(--color-dock-bg)",
          borderColor: "var(--color-dock-border)",
          borderRadius: 14,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 8px 24px var(--color-window-shadow), 0 1px 0 rgba(255,255,255,0.4) inset",
          maxWidth: isMobile ? "calc(100vw - 16px)" : undefined,
        }}
      >
        {DOCK_APPS.map((app) => {
          const win = windows.find((w) => w.appId === app.id);
          const isOpen = !!win;
          const visibleWindows = windows.filter((w) => w.isOpen && !w.isMinimized);
          const maxZ = visibleWindows.length
            ? Math.max(...visibleWindows.map((w) => w.zIndex))
            : 0;
          const isFocused = win && !win.isMinimized && win.zIndex >= maxZ;

          return (
            <div
              key={app.id}
              className="dock-item relative flex flex-col items-center"
            >
              <div
                className="dock-tooltip absolute -top-7 left-1/2 whitespace-nowrap border px-1.5 py-0.5 text-[11px]"
                style={{
                  background: "var(--color-surface-solid)",
                  borderColor: "var(--color-border)",
                  borderRadius: 4,
                  color: "var(--color-text)",
                }}
              >
                {app.title}
              </div>

              <button
                className="flex h-9 w-9 items-center justify-center transition-colors"
                style={{
                  background: isFocused
                    ? "var(--color-accent)"
                    : isOpen
                    ? "var(--color-surface-hover)"
                    : "transparent",
                  color: isFocused ? "white" : "var(--color-text-secondary)",
                  borderRadius: 8,
                }}
                onClick={() => {
                  if (!win) {
                    openWindow(app.id);
                  } else if (win.isMinimized) {
                    restoreWindow(app.id);
                  } else if (isFocused) {
                    minimizeWindow(app.id);
                  } else {
                    focusWindow(app.id);
                  }
                }}
                onMouseEnter={(e) => {
                  if (!isFocused && !isOpen) {
                    e.currentTarget.style.background = "var(--color-surface-hover)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isFocused && !isOpen) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
                aria-label={app.title}
              >
                {DOCK_ICONS[app.id] || (
                  <span style={{ fontSize: 16 }}>{app.icon}</span>
                )}
              </button>

              {isOpen && (
                <div
                  className="absolute -bottom-1 h-1 w-1 rounded-full"
                  style={{
                    background: isFocused
                      ? "var(--color-accent)"
                      : "var(--color-text-muted)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
