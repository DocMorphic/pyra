"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWindowManager } from "@/hooks/use-window-manager";
import { APP_REGISTRY } from "@/lib/constants";
import { WindowTitleBar } from "./WindowTitleBar";
import { WindowToolbar } from "./WindowToolbar";
import { WindowContent } from "./WindowContent";

const MOBILE_BREAKPOINT = 768;

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

interface WindowProps {
  appId: string;
  children: React.ReactNode;
  itemCount?: number;
  noResize?: boolean;
  showMinimize?: boolean;
  showMaximize?: boolean;
}

export function Window({
  appId,
  children,
  itemCount,
  noResize,
  showMinimize = true,
  showMaximize = true,
}: WindowProps) {
  const {
    windows,
    windowStatuses,
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    focusWindow,
    updatePosition,
    updateSize,
    getFocusedAppId,
  } = useWindowManager();

  const windowState = windows.find((w) => w.appId === appId);
  const appDef = APP_REGISTRY[appId];

  // Refs for direct DOM manipulation during drag/resize (avoids re-renders)
  const rootRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({
    dragging: false,
    resizing: false,
    startX: 0,
    startY: 0,
    startWinX: 0,
    startWinY: 0,
    startW: 0,
    startH: 0,
    // Latest values we'll commit to state on pointerUp
    latestX: 0,
    latestY: 0,
    latestW: 0,
    latestH: 0,
    rafPending: false,
  });

  const isFocused = getFocusedAppId() === appId;
  const statusText = windowStatuses[appId];
  const isMobile = useIsMobile();

  // === Drag handlers — direct DOM writes during move ===
  const handleDragDown = useCallback(
    (e: React.PointerEvent) => {
      if (!windowState) return;
      // Mobile: windows are forced full-screen anyway, and letting users
      // accidentally drag them off-screen is broken UX. Just focus + bail.
      if (isMobile) {
        focusWindow(appId);
        return;
      }
      dragState.current.dragging = true;
      dragState.current.startX = e.clientX;
      dragState.current.startY = e.clientY;
      dragState.current.startWinX = windowState.position.x;
      dragState.current.startWinY = windowState.position.y;
      dragState.current.latestX = windowState.position.x;
      dragState.current.latestY = windowState.position.y;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      focusWindow(appId);
    },
    [appId, focusWindow, windowState, isMobile]
  );

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    const s = dragState.current;
    if (!s.dragging || !rootRef.current) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    s.latestX = s.startWinX + dx;
    s.latestY = s.startWinY + dy;
    // Write directly to style — no React re-render during drag
    if (!s.rafPending) {
      s.rafPending = true;
      requestAnimationFrame(() => {
        s.rafPending = false;
        if (rootRef.current) {
          rootRef.current.style.left = `${s.latestX}px`;
          rootRef.current.style.top = `${s.latestY}px`;
        }
      });
    }
  }, []);

  const handleDragUp = useCallback(
    (e: React.PointerEvent) => {
      const s = dragState.current;
      if (!s.dragging) return;
      s.dragging = false;
      try {
        if (e.currentTarget && "releasePointerCapture" in e.currentTarget) {
          (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        }
      } catch {}
      // Commit the final position to state once
      updatePosition(appId, { x: s.latestX, y: s.latestY });
    },
    [appId, updatePosition]
  );

  // === Resize handlers — same pattern ===
  const handleResizeDown = useCallback(
    (e: React.PointerEvent) => {
      if (!windowState) return;
      e.stopPropagation();
      e.preventDefault();
      dragState.current.resizing = true;
      dragState.current.startX = e.clientX;
      dragState.current.startY = e.clientY;
      dragState.current.startW = windowState.size.width;
      dragState.current.startH = windowState.size.height;
      dragState.current.latestW = windowState.size.width;
      dragState.current.latestH = windowState.size.height;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      focusWindow(appId);
    },
    [appId, focusWindow, windowState]
  );

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    const s = dragState.current;
    if (!s.resizing || !rootRef.current) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    s.latestW = Math.max(280, s.startW + dx);
    s.latestH = Math.max(180, s.startH + dy);
    if (!s.rafPending) {
      s.rafPending = true;
      requestAnimationFrame(() => {
        s.rafPending = false;
        if (rootRef.current) {
          rootRef.current.style.width = `${s.latestW}px`;
          rootRef.current.style.height = `${s.latestH}px`;
        }
      });
    }
  }, []);

  const handleResizeUp = useCallback(
    (e: React.PointerEvent) => {
      const s = dragState.current;
      if (!s.resizing) return;
      s.resizing = false;
      try {
        if (e.currentTarget && "releasePointerCapture" in e.currentTarget) {
          (e.currentTarget as Element).releasePointerCapture(e.pointerId);
        }
      } catch {}
      updateSize(appId, { width: s.latestW, height: s.latestH });
    },
    [appId, updateSize]
  );

  const handleClose = useCallback(() => {
    dragState.current.dragging = false;
    dragState.current.resizing = false;
    closeWindow(appId);
  }, [appId, closeWindow]);

  const handleMinimize = useCallback(() => {
    dragState.current.dragging = false;
    dragState.current.resizing = false;
    minimizeWindow(appId);
  }, [appId, minimizeWindow]);

  const handleMaximize = useCallback(() => {
    dragState.current.dragging = false;
    dragState.current.resizing = false;
    maximizeWindow(appId);
  }, [appId, maximizeWindow]);

  if (!windowState || !appDef) return null;

  return (
    <div
      ref={rootRef}
      className="window-enter absolute flex flex-col overflow-hidden"
      style={{
        left: windowState.position.x,
        top: windowState.position.y,
        width: windowState.size.width,
        height: windowState.size.height,
        zIndex: windowState.zIndex,
        background: "var(--color-surface-solid)",
        border: "1px solid var(--color-card-border)",
        borderRadius: "var(--radius-window)",
        boxShadow: isFocused
          ? "0 12px 32px var(--color-window-shadow), 0 2px 6px var(--color-window-shadow)"
          : "0 6px 18px var(--color-window-shadow)",
      }}
      onMouseDown={() => focusWindow(appId)}
      role="dialog"
      aria-label={appDef.title}
    >
      <WindowTitleBar
        title={appDef.title}
        isFocused={isFocused}
        isMaximized={windowState.isMaximized}
        draggable={!isMobile}
        itemCount={itemCount}
        statusText={statusText}
        showMinimize={showMinimize}
        showMaximize={showMaximize}
        onClose={handleClose}
        onMinimize={handleMinimize}
        onMaximize={handleMaximize}
        onPointerDown={handleDragDown}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragUp}
      />
      <WindowToolbar appId={appId} />
      <WindowContent noPadding={appDef.noContentPadding}>{children}</WindowContent>

      {!noResize && (
        <div
          className="resize-handle"
          onPointerDown={handleResizeDown}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label="Resize window"
          title="Drag to resize"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <line x1="13" y1="3" x2="3" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="13" y1="7" x2="7" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="13" y1="11" x2="11" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>
  );
}
