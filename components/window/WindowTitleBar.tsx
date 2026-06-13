"use client";

import { useEffect, useRef, useState } from "react";

interface WindowTitleBarProps {
  title: string;
  isFocused: boolean;
  isMaximized?: boolean;
  draggable?: boolean;
  itemCount?: number;
  statusText?: string;
  showMinimize?: boolean;
  showMaximize?: boolean;
  onClose: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onCenter?: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}

/** PostHog/Windows-style title bar. The left file-icon + caret opens a real
 *  window menu; min/max/close sit on the right. */
export function WindowTitleBar({
  title,
  isFocused,
  isMaximized = false,
  showMinimize = true,
  showMaximize = true,
  onClose,
  onMinimize,
  onMaximize,
  onCenter,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: WindowTitleBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  return (
    <div
      className="relative flex h-10 shrink-0 items-center justify-between border-b pl-2 pr-1.5"
      style={{ background: "var(--color-titlebar)", borderColor: "var(--color-titlebar-border)" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Left — file icon + caret → window menu */}
      <div ref={menuRef} className="relative" onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        <button
          className="flex items-center gap-1 rounded px-1.5 py-1 transition-colors"
          style={{ color: "var(--color-text-muted)", background: menuOpen ? "var(--color-surface-hover)" : "transparent" }}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Window menu"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4" /><path d="M10 12h5M10 16h5" />
          </svg>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        {menuOpen && (
          <div
            className="menu-dropdown absolute left-0 top-full z-[700] mt-1 min-w-[168px] border p-1"
            style={{ background: "var(--color-surface-solid)", borderColor: "var(--color-border)", borderRadius: 8, boxShadow: "0 8px 24px var(--color-window-shadow)" }}
          >
            {showMinimize && <MenuItem label="Minimize" onClick={() => { setMenuOpen(false); onMinimize?.(); }} />}
            {showMaximize && <MenuItem label={isMaximized ? "Restore" : "Maximize"} onClick={() => { setMenuOpen(false); onMaximize?.(); }} />}
            {onCenter && <MenuItem label="Center window" onClick={() => { setMenuOpen(false); onCenter(); }} />}
            <div className="mx-2 my-1 h-px" style={{ background: "var(--color-border)" }} />
            <MenuItem label="Close" danger onClick={() => { setMenuOpen(false); onClose(); }} />
          </div>
        )}
      </div>

      {/* Title — CENTER */}
      <span
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 truncate text-[13px]"
        style={{ color: isFocused ? "var(--color-text)" : "var(--color-text-muted)", fontWeight: 700, maxWidth: "55%" }}
      >
        {title} <span style={{ color: "var(--color-text-dim)", fontWeight: 500 }}>— Pyra</span>
      </span>

      {/* Controls — RIGHT */}
      <div className="window-titlebar-controls flex h-full items-center gap-0.5" onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        {showMinimize && (
          <button className="window-control-btn" onClick={onMinimize} aria-label="Minimize">
            <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2.5" y1="6" x2="9.5" y2="6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
          </button>
        )}
        {showMaximize && (
          <button className="window-control-btn" onClick={onMaximize} aria-label={isMaximized ? "Restore" : "Maximize"}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2.5" y="2.5" width="7" height="7" rx="1" /></svg>
          </button>
        )}
        <button className="window-control-btn close" onClick={onClose} aria-label="Close">
          <svg width="12" height="12" viewBox="0 0 12 12"><line x1="3" y1="3" x2="9" y2="9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><line x1="9" y1="3" x2="3" y2="9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
        </button>
      </div>
    </div>
  );
}

function MenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      className="flex w-full items-center rounded px-2.5 py-1.5 text-left text-[12px] transition-colors"
      style={{ color: danger ? "var(--color-error)" : "var(--color-text)" }}
      onClick={onClick}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-surface-hover)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {label}
    </button>
  );
}
