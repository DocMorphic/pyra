"use client";

import { useWindowManager } from "@/hooks/use-window-manager";

const ic = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Slim PostHog-style window toolbar — only buttons that actually do something. */
export function WindowToolbar({ appId }: { appId: string }) {
  const { openWindow } = useWindowManager();

  return (
    <div
      className="flex h-9 shrink-0 items-center gap-1 border-b px-2"
      style={{ background: "var(--color-titlebar)", borderColor: "var(--color-titlebar-border)" }}
    >
      <button className="ph-tool" title="Refresh data" aria-label="Refresh" onClick={() => window.location.reload()}>
        <svg width="15" height="15" viewBox="0 0 24 24" {...ic}><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></svg>
      </button>
      <button className="ph-tool" title="Ask Sunny" aria-label="Ask Sunny" onClick={() => openWindow("copilot")}>
        <svg width="15" height="15" viewBox="0 0 24 24" {...ic}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
      </button>
      <button className="ph-tool" title="Settings" aria-label="Settings" onClick={() => openWindow("settings")}>
        <svg width="15" height="15" viewBox="0 0 24 24" {...ic}><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.5 1.5M16.9 16.9l1.5 1.5M5.6 18.4l1.5-1.5M16.9 7.1l1.5-1.5" /></svg>
      </button>

      <div className="flex-1" />

      <button className="ph-tool" title="Open Executive Report" onClick={() => openWindow("report")}>
        <svg width="15" height="15" viewBox="0 0 24 24" {...ic}><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h6" /></svg>
      </button>
      {appId === "report" && (
        <button className="ph-btn ml-1 text-[12px]" style={{ padding: "4px 13px" }} onClick={() => window.print()} title="Print / export to PDF">
          Export
        </button>
      )}
    </div>
  );
}
