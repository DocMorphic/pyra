"use client";

import { useEffect, useRef } from "react";

export interface ModalAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger";
}

interface ModalProps {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  actions: ModalAction[];
  onDismiss?: () => void;
  variant?: "neutral" | "danger";
}

/**
 * Aliquot-themed dialog. Backdrop + centered card with title, optional
 * message, and action buttons. Used by `useModal()` for confirm / alert
 * flows so we never have to fall back to the browser's `window.confirm`
 * (which renders in the OS chrome and breaks the OS-style illusion).
 *
 * Esc closes via onDismiss. Backdrop click closes via onDismiss.
 * No focus trap — adequate for the hackathon scope; revisit later.
 */
export function Modal({
  open,
  title,
  message,
  actions,
  onDismiss,
  variant = "neutral",
}: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss?.();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onDismiss]);

  // Auto-focus the primary action when the modal opens.
  useEffect(() => {
    if (!open) return;
    const primary = cardRef.current?.querySelector<HTMLButtonElement>(
      "[data-modal-primary='true']"
    );
    primary?.focus();
  }, [open]);

  if (!open) return null;

  const accentColor =
    variant === "danger" ? "var(--color-error)" : "var(--color-accent)";

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      style={{
        background: "rgba(12, 10, 9, 0.45)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        animation: "modal-fade-in 0.12s ease-out",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={cardRef}
        className="w-[420px] max-w-[calc(100vw-32px)] border"
        style={{
          background: "var(--color-surface-solid)",
          borderColor: "var(--color-border-strong)",
          borderRadius: 8,
          boxShadow: "0 20px 50px var(--color-window-shadow), 0 4px 12px rgba(0,0,0,0.08)",
          animation: "modal-pop 0.14s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent stripe — matches active accent (or red for danger) */}
        <div style={{ background: accentColor, height: 3, borderTopLeftRadius: 8, borderTopRightRadius: 8 }} />

        <div className="p-5">
          <h3
            id="modal-title"
            className="text-[14.5px]"
            style={{ color: "var(--color-text)", fontWeight: 600 }}
          >
            {title}
          </h3>
          {message && (
            <div
              className="mt-2 text-[12.5px]"
              style={{ color: "var(--color-text-secondary)", lineHeight: 1.55 }}
            >
              {message}
            </div>
          )}

          <div className="mt-5 flex justify-end gap-2">
            {actions.map((a, i) => {
              const isPrimary = a.variant === "primary" || a.variant === "danger";
              const buttonBg =
                a.variant === "danger"
                  ? "var(--color-error)"
                  : a.variant === "primary"
                  ? "var(--color-accent)"
                  : "var(--color-surface-alt)";
              const buttonColor =
                a.variant === "secondary" || !a.variant
                  ? "var(--color-text)"
                  : "white";
              return (
                <button
                  key={i}
                  data-modal-primary={isPrimary || undefined}
                  onClick={a.onClick}
                  className="border px-4 py-1.5 text-[12.5px] transition-colors"
                  style={{
                    background: buttonBg,
                    color: buttonColor,
                    borderColor:
                      a.variant === "danger"
                        ? "var(--color-error)"
                        : a.variant === "primary"
                        ? "var(--color-accent)"
                        : "var(--color-border)",
                    borderRadius: 4,
                    fontWeight: isPrimary ? 500 : 400,
                  }}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes modal-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modal-pop {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
