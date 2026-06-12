"use client";

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
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}

export function WindowTitleBar({
  title,
  isFocused,
  isMaximized = false,
  draggable = true,
  itemCount,
  statusText,
  showMinimize = true,
  showMaximize = true,
  onClose,
  onMinimize,
  onMaximize,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: WindowTitleBarProps) {
  return (
    <div
      // Title bar drives drag via pointer events — visual cursor stays
      // default at the user's request (per polish v4 feedback).
      className="relative flex h-9 shrink-0 items-center justify-between border-b pl-3 pr-2"
      style={{
        background: "var(--color-titlebar)",
        borderColor: "var(--color-titlebar-border)",
        cursor: draggable ? "default" : "default",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Controls — LEFT (macOS-style traffic lights). The container
         class drives the :hover reveal of all three glyphs at once. */}
      <div
        className="window-titlebar-controls flex h-full items-center gap-2"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          className="window-control-btn close"
          onClick={onClose}
          aria-label="Close"
        >
          <svg width="6" height="6" viewBox="0 0 6 6">
            <line x1="1.4" y1="1.4" x2="4.6" y2="4.6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            <line x1="4.6" y1="1.4" x2="1.4" y2="4.6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        </button>

        {showMinimize && (
          <button
            className="window-control-btn minimize"
            onClick={onMinimize}
            aria-label="Minimize"
          >
            <svg width="6" height="6" viewBox="0 0 6 6">
              <line x1="1" y1="3" x2="5" y2="3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
          </button>
        )}

        {showMaximize && (
          <button
            className="window-control-btn maximize"
            onClick={onMaximize}
            aria-label={isMaximized ? "Restore" : "Maximize"}
          >
            <svg width="6" height="6" viewBox="0 0 6 6">
              {isMaximized ? (
                <>
                  <line x1="1" y1="3" x2="5" y2="3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                  <line x1="3" y1="1" x2="3" y2="5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                </>
              ) : (
                <>
                  <polygon points="1,4.5 4.5,4.5 4.5,1" fill="currentColor" />
                  <polygon points="1,1.5 1.5,1 4.5,1 4.5,1.5 1.5,4.5 1,4.5" fill="currentColor" opacity="0.001" />
                </>
              )}
            </svg>
          </button>
        )}
      </div>

      {/* Title — CENTER */}
      <span
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 truncate text-[12.5px]"
        style={{
          color: isFocused ? "var(--color-text-secondary)" : "var(--color-text-muted)",
          fontWeight: 500,
          maxWidth: "60%",
        }}
      >
        {title}
      </span>

      {/* Status / count — RIGHT */}
      <div className="flex h-full items-center text-[11px]" style={{ color: "var(--color-text-muted)" }}>
        {statusText ? (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--color-accent)" }}
            />
            {statusText}
          </span>
        ) : typeof itemCount === "number" ? (
          <span>{itemCount} items</span>
        ) : null}
      </div>
    </div>
  );
}
