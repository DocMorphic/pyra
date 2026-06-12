"use client";

import { useState } from "react";
import { AppHeader } from "./_shared";

interface Msg {
  role: "user" | "assistant";
  text: string;
}

const SUGGESTIONS = [
  "What happened on the worst inverter?",
  "Which module type degrades fastest?",
  "How much revenue did faults cost in 2024?",
];

export function CopilotApp() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");

  function send(text: string) {
    const q = text.trim();
    if (!q) return;
    // Wired to the Anthropic-backed /api/copilot route in a later step.
    setMessages((m) => [
      ...m,
      { role: "user", text: q },
      {
        role: "assistant",
        text: "The O&M Copilot connects in the next build step — it will answer grounded on the loss ledger, degradation models, error codes and tickets.",
      },
    ]);
    setInput("");
  }

  return (
    <div className="flex h-full flex-col">
      <AppHeader title="O&M Copilot" subtitle="Ask about losses, faults, and what to do next" />

      <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto pr-1">
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
          placeholder="Ask the Copilot…"
          className="flex-1 rounded-lg px-3 py-2 text-[12.5px] outline-none"
          style={{
            background: "var(--color-input-bg)",
            border: "1px solid var(--color-input-border)",
            color: "var(--color-text)",
          }}
        />
        <button
          type="submit"
          className="rounded-lg px-3 py-2 text-[12.5px] font-medium"
          style={{ background: "var(--color-accent)", color: "#fff" }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
