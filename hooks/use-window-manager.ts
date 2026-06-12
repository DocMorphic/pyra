"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import type { WindowState, WindowContext } from "@/lib/types";
import { APP_REGISTRY } from "@/lib/constants";

// Reserved zones
const MENUBAR_HEIGHT = 34;
// Dock visual footprint from the viewport bottom (includes bottom offset
// + padding + button height + border). On mobile the dock is bigger AND
// sits higher off the bottom edge (bottom-5 vs desktop bottom-2), so its
// real footprint is ~88px; we reserve 100 to leave a clear buffer so
// windows never tuck under the dock on viewports where Safari's URL bar
// jitters during scroll.
const DOCK_HEIGHT_DESKTOP = 72;
const DOCK_HEIGHT_MOBILE = 100;
const MIN_MARGIN = 12;
const MIN_W = 280;
const MIN_H = 180;
const TITLEBAR_VISIBLE_MIN = 100;

// Mobile (< MOBILE_BREAKPOINT) reserves extra vertical space at the top
// of the desktop for the horizontally-scrolling icon row.
const MOBILE_BREAKPOINT = 768;
const MOBILE_ICON_ROW_RESERVE = 96;

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function dockFootprint() {
  return isMobileViewport() ? DOCK_HEIGHT_MOBILE : DOCK_HEIGHT_DESKTOP;
}

function topReserve() {
  return isMobileViewport() ? MOBILE_ICON_ROW_RESERVE : 0;
}

interface WindowManagerContextValue {
  windows: WindowState[];
  windowStatuses: Record<string, string>;
  windowContexts: Record<string, WindowContext>;
  openWindow: (appId: string, context?: WindowContext) => void;
  closeWindow: (appId: string) => void;
  minimizeWindow: (appId: string) => void;
  restoreWindow: (appId: string) => void;
  focusWindow: (appId: string) => void;
  updatePosition: (appId: string, position: { x: number; y: number }) => void;
  updateSize: (appId: string, size: { width: number; height: number }) => void;
  centerWindow: (appId: string) => void;
  maximizeWindow: (appId: string) => void;
  setWindowStatus: (appId: string, status: string) => void;
  setWindowContext: (appId: string, patch: WindowContext) => void;
  getOpenWindows: () => WindowState[];
  getFocusedAppId: () => string | null;
}

export const WindowManagerContext = createContext<WindowManagerContextValue | null>(null);

export function useWindowManager(): WindowManagerContextValue {
  const ctx = useContext(WindowManagerContext);
  if (!ctx) throw new Error("useWindowManager must be used within WindowManagerProvider");
  return ctx;
}

function clampPosition(x: number, y: number, w: number, h: number) {
  if (typeof window === "undefined") return { x, y };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const minX = TITLEBAR_VISIBLE_MIN - w;
  const maxX = vw - TITLEBAR_VISIBLE_MIN;
  const minY = topReserve();
  // Cap y so the window's bottom always clears the dock + a margin.
  // Previously this was `(vh - MENUBAR_HEIGHT) - 44`, which let drag
  // push windows' bodies under the taskbar. Now we subtract the dock
  // footprint plus the window's own height so the bottom edge stops
  // above the dock with a small margin.
  const maxY = Math.max(
    minY,
    vh - MENUBAR_HEIGHT - dockFootprint() - h - MIN_MARGIN
  );
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

function clampSize(w: number, h: number) {
  if (typeof window === "undefined") return { width: w, height: h };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mobile = isMobileViewport();
  const maxW = vw - MIN_MARGIN * 2;
  const maxH = vh - MENUBAR_HEIGHT - dockFootprint() - MIN_MARGIN * 2 - topReserve();
  // On mobile, force windows to the viewport width regardless of default.
  // Min is loosened so small phones (<300px) still get a usable window.
  const minW = mobile ? Math.min(240, maxW) : MIN_W;
  const minH = mobile ? Math.min(220, maxH) : MIN_H;
  const desiredW = mobile ? maxW : w;
  const desiredH = mobile ? maxH : h;
  return {
    width: Math.max(minW, Math.min(maxW, desiredW)),
    height: Math.max(minH, Math.min(maxH, desiredH)),
  };
}

export function useWindowManagerProvider(): WindowManagerContextValue {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [windowStatuses, setWindowStatuses] = useState<Record<string, string>>({});
  const [windowContexts, setWindowContexts] = useState<Record<string, WindowContext>>({});
  const zIndexCounter = useRef(10);

  const openWindow = useCallback((appId: string, context?: WindowContext) => {
    const appDef = APP_REGISTRY[appId];
    if (!appDef) return;

    // Store/merge context
    if (context) {
      setWindowContexts((prev) => ({ ...prev, [appId]: { ...prev[appId], ...context } }));
    }

    setWindows((prev) => {
      const existing = prev.find((w) => w.appId === appId);
      if (existing) {
        const newZ = ++zIndexCounter.current;
        return prev.map((w) =>
          w.appId === appId ? { ...w, isMinimized: false, zIndex: newZ } : w
        );
      }

      const newZ = ++zIndexCounter.current;
      const clampedSize = clampSize(appDef.defaultWidth, appDef.defaultHeight);

      let defaultX = appDef.defaultX;
      let defaultY = appDef.defaultY;

      if (typeof window !== "undefined") {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const reserve = topReserve();
        const mobile = isMobileViewport();
        const contentHeight = vh - MENUBAR_HEIGHT - reserve;
        const offset = mobile ? 0 : (prev.length % 5) * 24;
        defaultX = Math.max(
          MIN_MARGIN,
          Math.floor((vw - clampedSize.width) / 2) + offset
        );
        // Top-biased: anchor windows in the upper third with a min 30px
        // offset, so the title bar is reachable on iPad / pinch-zoomed
        // visual viewports where the bottom can be clipped.
        defaultY = Math.max(
          MIN_MARGIN + reserve,
          reserve +
            Math.max(
              30,
              Math.floor((contentHeight - clampedSize.height - dockFootprint()) / 3)
            ) +
            offset
        );

        // Cap defaultY so the window bottom always clears the dock, even
        // if the cascade `offset` pushed us down. Previously the 4th/5th
        // window in a stack could land with its bottom tucked behind the
        // taskbar on desktop (offset = 72px, 96px).
        const maxDefaultY =
          vh - MENUBAR_HEIGHT - dockFootprint() - clampedSize.height - MIN_MARGIN;
        defaultY = Math.min(defaultY, Math.max(MIN_MARGIN + reserve, maxDefaultY));
      }

      const pos = clampPosition(defaultX, defaultY, clampedSize.width, clampedSize.height);

      const newWindow: WindowState = {
        appId,
        isOpen: true,
        isMinimized: false,
        isMaximized: false,
        zIndex: newZ,
        position: pos,
        size: clampedSize,
      };
      return [...prev, newWindow];
    });
  }, []);

  const closeWindow = useCallback((appId: string) => {
    setWindows((prev) => prev.filter((w) => w.appId !== appId));
    setWindowStatuses((prev) => {
      const next = { ...prev };
      delete next[appId];
      return next;
    });
    setWindowContexts((prev) => {
      const next = { ...prev };
      delete next[appId];
      return next;
    });
  }, []);

  const minimizeWindow = useCallback((appId: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.appId === appId ? { ...w, isMinimized: true } : w))
    );
  }, []);

  const restoreWindow = useCallback((appId: string) => {
    const newZ = ++zIndexCounter.current;
    setWindows((prev) =>
      prev.map((w) => (w.appId === appId ? { ...w, isMinimized: false, zIndex: newZ } : w))
    );
  }, []);

  const focusWindow = useCallback((appId: string) => {
    setWindows((prev) => {
      const w = prev.find((win) => win.appId === appId);
      if (!w) return prev;
      // Only bump z-index if not already topmost
      const currentMax = Math.max(
        ...prev.filter((win) => win.isOpen && !win.isMinimized).map((win) => win.zIndex)
      );
      if (w.zIndex >= currentMax) return prev;
      const newZ = ++zIndexCounter.current;
      return prev.map((win) =>
        win.appId === appId ? { ...win, zIndex: newZ } : win
      );
    });
  }, []);

  const updatePosition = useCallback(
    (appId: string, position: { x: number; y: number }) => {
      setWindows((prev) =>
        prev.map((w) => {
          if (w.appId !== appId) return w;
          const clamped = clampPosition(position.x, position.y, w.size.width, w.size.height);
          return { ...w, position: clamped };
        })
      );
    },
    []
  );

  const updateSize = useCallback(
    (appId: string, size: { width: number; height: number }) => {
      setWindows((prev) =>
        prev.map((w) => {
          if (w.appId !== appId) return w;
          const clamped = clampSize(size.width, size.height);
          // Manual resize drops the maximize flag — no more restore icon.
          return {
            ...w,
            size: clamped,
            isMaximized: false,
            preMaxPosition: undefined,
            preMaxSize: undefined,
          };
        })
      );
    },
    []
  );

  const centerWindow = useCallback((appId: string) => {
    if (typeof window === "undefined") return;
    const vw = window.innerWidth;
    const contentHeight = window.innerHeight - MENUBAR_HEIGHT;
    setWindows((prev) =>
      prev.map((w) => {
        if (w.appId !== appId) return w;
        const x = Math.floor((vw - w.size.width) / 2);
        const y = Math.floor((contentHeight - w.size.height - dockFootprint()) / 2);
        return { ...w, position: clampPosition(x, y, w.size.width, w.size.height) };
      })
    );
  }, []);

  const maximizeWindow = useCallback((appId: string) => {
    if (typeof window === "undefined") return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setWindows((prev) =>
      prev.map((w) => {
        if (w.appId !== appId) return w;

        // Toggle off — restore the previous bounds
        if (w.isMaximized && w.preMaxSize && w.preMaxPosition) {
          return {
            ...w,
            isMaximized: false,
            isMinimized: false,
            position: w.preMaxPosition,
            size: w.preMaxSize,
            preMaxPosition: undefined,
            preMaxSize: undefined,
            zIndex: ++zIndexCounter.current,
          };
        }

        // Toggle on — remember current bounds, fill the desktop. We do NOT
        // subtract topReserve here because the point of maximize on mobile
        // is to cover the icon row (dock is still visible at the bottom).
        const size = {
          width: vw - MIN_MARGIN * 2,
          height: vh - MENUBAR_HEIGHT - dockFootprint() - MIN_MARGIN * 2,
        };
        return {
          ...w,
          isMaximized: true,
          isMinimized: false,
          preMaxPosition: w.position,
          preMaxSize: w.size,
          size,
          position: { x: MIN_MARGIN, y: MIN_MARGIN },
          zIndex: ++zIndexCounter.current,
        };
      })
    );
  }, []);

  const setWindowStatus = useCallback((appId: string, status: string) => {
    setWindowStatuses((prev) => {
      if (prev[appId] === status) return prev;
      return { ...prev, [appId]: status };
    });
  }, []);

  const setWindowContext = useCallback((appId: string, patch: WindowContext) => {
    setWindowContexts((prev) => ({ ...prev, [appId]: { ...prev[appId], ...patch } }));
  }, []);

  const getOpenWindows = useCallback(() => windows.filter((w) => w.isOpen), [windows]);

  const getFocusedAppId = useCallback(() => {
    const visible = windows.filter((w) => w.isOpen && !w.isMinimized);
    if (visible.length === 0) return null;
    return visible.reduce((a, b) => (a.zIndex > b.zIndex ? a : b)).appId;
  }, [windows]);

  return {
    windows,
    windowStatuses,
    windowContexts,
    openWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    focusWindow,
    updatePosition,
    updateSize,
    centerWindow,
    maximizeWindow,
    setWindowStatus,
    setWindowContext,
    getOpenWindows,
    getFocusedAppId,
  };
}
