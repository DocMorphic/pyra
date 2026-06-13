"use client";

import { useRef, useState, type ReactNode } from "react";
import { AppHeader } from "./_shared";
import { usePyraData } from "@/hooks/use-pyra-data";

interface Msg {
  role: "user" | "assistant";
  text: string;
}

// --- tiny markdown renderer (the Copilot replies in markdown) -------------
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2] !== undefined) out.push(<strong key={k++} style={{ color: "var(--color-text)" }}>{m[2]}</strong>);
    else out.push(
      <code key={k++} className="font-mono rounded px-1 text-[11px]"
        style={{ background: "var(--color-info-box)", color: "var(--color-text-secondary)" }}>{m[3]}</code>
    );
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const BLOCK_START = /^(\||#{1,6}\s|[-*]\s|\d+\.\s)/;

function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0, key = 0;
  const td = "px-2 py-1 text-left align-top";
  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t) { i++; continue; }

    if (t.startsWith("|")) {                                   // table
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { rows.push(lines[i].trim()); i++; }
      const cells = rows
        .filter((r) => !/^\|?[\s:|-]+\|?$/.test(r))            // drop |---|---| separators
        .map((r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
      if (cells.length) {
        const [head, ...body] = cells;
        blocks.push(
          <div key={key++} className="custom-scrollbar overflow-x-auto">
            <table className="w-full border-collapse text-[11.5px]">
              <thead><tr style={{ color: "var(--color-text-muted)" }}>
                {head.map((c, j) => <th key={j} className={`${td} font-medium`}>{inline(c)}</th>)}
              </tr></thead>
              <tbody>{body.map((r, ri) => (
                <tr key={ri} style={{ borderTop: "1px solid var(--color-border)" }}>
                  {r.map((c, j) => <td key={j} className={`${td} tabular-nums`}>{inline(c)}</td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(t);                     // heading
    if (h) {
      blocks.push(<div key={key++} className="text-[13px] font-bold" style={{ color: "var(--color-text)" }}>{inline(h[2])}</div>);
      i++; continue;
    }

    if (/^[-*]\s+/.test(t)) {                                  // bullet list
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^[-*]\s+/, "")); i++; }
      blocks.push(<ul key={key++} className="ml-1 space-y-0.5">{items.map((it, j) => (
        <li key={j} className="flex gap-1.5"><span style={{ color: "var(--color-accent)" }}>•</span><span>{inline(it)}</span></li>
      ))}</ul>);
      continue;
    }

    if (/^\d+\.\s+/.test(t)) {                                 // numbered list
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^\d+\.\s+/, "")); i++; }
      blocks.push(<ol key={key++} className="ml-1 space-y-0.5">{items.map((it, j) => (
        <li key={j} className="flex gap-1.5"><span className="tabular-nums" style={{ color: "var(--color-text-muted)" }}>{j + 1}.</span><span>{inline(it)}</span></li>
      ))}</ol>);
      continue;
    }

    const para: string[] = [];                                 // paragraph
    while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i].trim())) { para.push(lines[i].trim()); i++; }
    blocks.push(<p key={key++}>{inline(para.join(" "))}</p>);
  }
  return <div className="space-y-2">{blocks}</div>;
}

const SUGGESTIONS = [
  "What happened on the worst inverter?",
  "Which module type degrades fastest?",
  "Which inverters should we service first?",
];

export function CopilotApp() {
  const { activeDataset } = usePyraData();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setError(null);
    setInput("");
    const next = [...messages, { role: "user" as const, text: q }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, datasetId: activeDataset.id === "demo" ? undefined : activeDataset.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setMessages((m) => [...m, { role: "assistant", text: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
      );
    }
  }

  return (
    <div className="flex h-full flex-col">
      <AppHeader title="O&M Copilot" subtitle="Ask about losses, faults, and what to do next" />

      <div ref={scrollRef} className="custom-scrollbar flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <div className="space-y-2 pt-2">
            <div className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
              Try asking:
            </div>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full rounded-lg px-3 py-2 text-left text-[12.5px] transition-colors"
                style={{
                  background: "var(--color-surface-alt)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-secondary)",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className="rounded-lg px-3 py-2 text-[12.5px] leading-relaxed"
              style={{
                background: m.role === "user" ? "var(--color-accent)" : "var(--color-surface-alt)",
                color: m.role === "user" ? "#fff" : "var(--color-text)",
                border: m.role === "user" ? "none" : "1px solid var(--color-border)",
                marginLeft: m.role === "user" ? 40 : 0,
                marginRight: m.role === "user" ? 0 : 40,
              }}
            >
              {m.role === "assistant" ? <Markdown text={m.text} /> : m.text}
            </div>
          ))
        )}
        {busy && (
          <div className="flex items-center gap-1.5 px-1 text-[12px]" style={{ color: "var(--color-text-muted)" }}>
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--color-accent)" }} />
            Copilot is thinking…
          </div>
        )}
        {error && (
          <div className="rounded-lg px-3 py-2 text-[12px]" style={{ background: "rgba(220,38,38,0.1)", color: "var(--color-error)", border: "1px solid var(--color-error)" }}>
            {error}
          </div>
        )}
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          placeholder={busy ? "Sunny's thinking…" : "Ask Sunny anything…"}
          className="flex-1 px-3.5 py-2 text-[12.5px] outline-none disabled:opacity-60"
          style={{
            background: "var(--color-input-bg)",
            border: "1px solid var(--color-input-border)",
            color: "var(--color-text)",
            borderRadius: "var(--radius-pill)",
          }}
        />
        <button type="submit" disabled={busy} className="ph-btn text-[12.5px]">
          Ask
        </button>
      </form>
    </div>
  );
}
