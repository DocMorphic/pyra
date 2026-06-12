"use client";

import { createContext, useCallback, useContext, useState } from "react";

export interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Switch the confirm button to red and use a red accent stripe. */
  danger?: boolean;
}

export interface AlertOptions {
  title: string;
  message?: React.ReactNode;
  okLabel?: string;
}

interface InternalConfig extends ConfirmOptions {
  /** false → only the OK button (alert flow). */
  isConfirm: boolean;
  resolve: (value: boolean) => void;
}

interface ModalContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  alert: (opts: AlertOptions) => Promise<void>;
  /** Internal — the desktop component reads this to render the active modal. */
  _active: InternalConfig | null;
  _dismiss: (value: boolean) => void;
}

export const ModalContext = createContext<ModalContextValue | null>(null);

export function useModal(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal must be used within ModalProvider");
  return ctx;
}

export function useModalProvider(): ModalContextValue {
  const [active, setActive] = useState<InternalConfig | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setActive({ ...opts, isConfirm: true, resolve });
    });
  }, []);

  const alertFn = useCallback((opts: AlertOptions) => {
    return new Promise<void>((resolve) => {
      setActive({
        title: opts.title,
        message: opts.message,
        confirmLabel: opts.okLabel ?? "OK",
        isConfirm: false,
        resolve: () => resolve(),
      });
    });
  }, []);

  const dismiss = useCallback((value: boolean) => {
    setActive((prev) => {
      prev?.resolve(value);
      return null;
    });
  }, []);

  return {
    confirm,
    alert: alertFn,
    _active: active,
    _dismiss: dismiss,
  };
}
