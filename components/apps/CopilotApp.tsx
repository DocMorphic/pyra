"use client";

import { useRef, useState } from "react";
import { AppHeader } from "./_shared";

interface Msg {
  role: "user" | "assistant";
  text: string;
}

const SUGGESTIONS = [
  "What happened on the worst inverter?",
  "Which module type degrades fastest?",
  "Which inverters should we service first?",
];

export function CopilotApp() {
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
        body: JSON.stringify({ messages: next }),
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
              {m.text}
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
          placeholder={busy ? "Waiting for reply…" : "Ask the Copilot…"}
          className="flex-1 rounded-lg px-3 py-2 text-[12.5px] outline-none disabled:opacity-60"
          style={{
            background: "var(--color-input-bg)",
            border: "1px solid var(--color-input-border)",
            color: "var(--color-text)",
          }}
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg px-3 py-2 text-[12.5px] font-medium disabled:opacity-60"
          style={{ background: "var(--color-accent)", color: "#fff" }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
