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
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2
          className="text-[21px] font-bold leading-tight"
          style={{ color: "var(--color-text)", letterSpacing: "-0.015em" }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--color-text-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {right}
    </div>
  );
}

/** Section heading with a colored square bullet (PostHog marker). */
export function SectionTitle({ children, color = "var(--color-accent)" }: { children: ReactNode; color?: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="ph-bullet" style={{ background: color }} />
      <h3 className="text-[14px] font-bold" style={{ color: "var(--color-text)" }}>{children}</h3>
    </div>
  );
}

/** Boxed section card (PostHog reporting card). */
export function SectionCard({ title, color, right, children }: { title?: string; color?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="ph-section mb-3 p-3.5">
      {title && (
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle color={color}>{title}</SectionTitle>
          {right}
        </div>
      )}
      {children}
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
  variant?: "primary" | "secondary" | "gold";
  disabled?: boolean;
  className?: string;
}) {
  const v = variant === "primary" ? "" : variant;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`ph-btn text-[12.5px] ${v} ${className}`}
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
  const accent =
    tone === "default" ? "var(--color-border-hover)" : color;
  return (
    <div
      className="ph-card flex-1 px-3.5 py-3"
      style={{ borderBottom: `3px solid ${accent}` }}
    >
      <div className="ph-label">{label}</div>
      <div className="font-mono mt-1.5 text-[23px] font-bold tabular-nums leading-none" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
