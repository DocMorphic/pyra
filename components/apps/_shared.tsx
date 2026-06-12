"use client";

import type { ReactNode } from "react";
import { Sunny } from "@/components/ui/Sunny";

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

/** Empty state — Sunny shows up with a wink. */
export function EmptyState({
  title,
  hint,
  mood = "happy",
  showCmd = true,
}: {
  icon?: string;
  title: string;
  hint?: string;
  mood?: "happy" | "worried";
  showCmd?: boolean;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <Sunny size={72} mood={mood} />
      <div className="mt-1 text-[13px] font-semibold" style={{ color: "var(--color-text)" }}>
        {title}
      </div>
      {hint && (
        <div className="max-w-[320px] text-[11.5px] leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          {hint}
        </div>
      )}
      {showCmd && (
        <code
          className="font-mono mt-1 rounded px-2 py-1 text-[11px]"
          style={{ background: "var(--color-info-box)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}
        >
          python pipeline/build.py
        </code>
      )}
    </div>
  );
}

/** PostHog-style pill button. */
export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`ph-btn text-[12.5px] ${variant === "secondary" ? "secondary" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

/** Small rotated hand-stuck sticker. */
export function Sticker({ children, color = "var(--color-yellow)" }: { children: ReactNode; color?: string }) {
  return (
    <span className="ph-sticker" style={{ background: color }}>
      {children}
    </span>
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
    <div className="ph-card flex-1 px-3 py-2.5">
      <div className="ph-label">{label}</div>
      <div className="font-mono mt-1 text-[19px] font-bold tabular-nums leading-none" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
