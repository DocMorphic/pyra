"use client";

import type { ReactNode } from "react";

/** Section heading used across Pyra app windows. */
export function AppHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2
          className="text-[15px] font-semibold leading-tight"
          style={{ color: "var(--color-text)" }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--color-text-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {right}
    </div>
  );
}

/** Empty state shown until the Python pipeline emits artifacts. */
export function EmptyState({
  icon = "☀️",
  title,
  hint,
}: {
  icon?: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full text-[22px]"
        style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)" }}
      >
        {icon}
      </div>
      <div className="text-[13px] font-medium" style={{ color: "var(--color-text)" }}>
        {title}
      </div>
      {hint && (
        <div className="max-w-[320px] text-[11.5px] leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          {hint}
        </div>
      )}
      <code
        className="font-mono mt-1 rounded px-2 py-1 text-[11px]"
        style={{ background: "var(--color-info-box)", color: "var(--color-text-secondary)" }}
      >
        python pipeline/build.py
      </code>
    </div>
  );
}

/** A small labelled stat / KPI tile. */
export function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warn" | "error" | "success" | "accent";
}) {
  const color =
    tone === "error"
      ? "var(--color-error)"
      : tone === "warn"
      ? "var(--color-warn)"
      : tone === "success"
      ? "var(--color-success)"
      : tone === "accent"
      ? "var(--color-accent)"
      : "var(--color-text)";
  return (
    <div
      className="flex-1 rounded-lg px-3 py-2.5"
      style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-border)" }}
    >
      <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
        {label}
      </div>
      <div className="font-mono mt-0.5 text-[18px] font-semibold tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
