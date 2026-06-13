"use client";

/** Decorative document-editor toolbar ribbon — PostHog's signature window
 *  chrome. Mostly visual (undo/redo, zoom, B/I/U, font, align, search, ⚙)
 *  with a single live yellow action button on the right. */
export function WindowToolbar({
  action = "Share",
  onAction,
}: {
  action?: string;
  onAction?: () => void;
}) {
  const ic = {
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <div
      className="flex h-10 shrink-0 items-center gap-1 border-b px-2"
      style={{ background: "var(--color-titlebar)", borderColor: "var(--color-titlebar-border)" }}
    >
      <button className="ph-tool" title="Undo" aria-label="Undo">
        <svg width="15" height="15" viewBox="0 0 24 24" {...ic}><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></svg>
      </button>
      <button className="ph-tool" title="Redo" aria-label="Redo">
        <svg width="15" height="15" viewBox="0 0 24 24" {...ic}><path d="M15 14l5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h3" /></svg>
      </button>

      <Divider />
      <button className="ph-tool pill" title="Zoom">Zoom <Caret /></button>

      <Divider />
      <button className="ph-tool font-bold" title="Bold">B</button>
      <button className="ph-tool italic" title="Italic">I</button>
      <button className="ph-tool" title="Underline" style={{ textDecoration: "underline" }}>U</button>

      <Divider />
      <button className="ph-tool pill" title="Font">Font <Caret /></button>

      <Divider />
      <button className="ph-tool" title="Align left" aria-label="Align left">
        <svg width="15" height="15" viewBox="0 0 24 24" {...ic}><path d="M4 6h16M4 12h10M4 18h13" /></svg>
      </button>
      <button className="ph-tool" title="Align center" aria-label="Align center">
        <svg width="15" height="15" viewBox="0 0 24 24" {...ic}><path d="M4 6h16M7 12h10M5 18h14" /></svg>
      </button>
      <button className="ph-tool" title="Align right" aria-label="Align right">
        <svg width="15" height="15" viewBox="0 0 24 24" {...ic}><path d="M4 6h16M10 12h10M7 18h13" /></svg>
      </button>

      <div className="flex-1" />

      <button className="ph-tool" title="Search" aria-label="Search">
        <svg width="15" height="15" viewBox="0 0 24 24" {...ic}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
      </button>
      <button className="ph-tool" title="Settings" aria-label="Settings">
        <svg width="15" height="15" viewBox="0 0 24 24" {...ic}><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.5 1.5M16.9 16.9l1.5 1.5M5.6 18.4l1.5-1.5M16.9 7.1l1.5-1.5" /></svg>
      </button>
      <button className="ph-btn ml-1 text-[12px]" style={{ padding: "5px 14px" }} onClick={onAction}>
        {action}
      </button>
    </div>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px" style={{ background: "var(--color-border)" }} />;
}
function Caret() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
