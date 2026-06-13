"use client";

import { createContext, useContext, useEffect, useCallback } from "react";
import type { ThemeMode, ThemeState } from "@/lib/types";
import { STORAGE_KEYS, DEFAULT_THEME } from "@/lib/constants";
import { useLocalStorage } from "./use-local-storage";

// PostHog categorical accents.
export type AccentColor = "red" | "blue" | "yellow";

interface ThemeContextValue extends ThemeState {
  accent: AccentColor;
  companion: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  setBrightness: (value: number) => void;
  setAccent: (a: AccentColor) => void;
  setCompanion: (v: boolean) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function useThemeProvider(): ThemeContextValue {
  const [mode, setModeRaw] = useLocalStorage<ThemeMode>(STORAGE_KEYS.theme, DEFAULT_THEME.mode);
  const [brightness, setBrightnessRaw] = useLocalStorage<number>(
    STORAGE_KEYS.brightness,
    DEFAULT_THEME.brightness
  );
  const [accent, setAccentRaw] = useLocalStorage<AccentColor>(STORAGE_KEYS.accent, "red");
  const [companion, setCompanionRaw] = useLocalStorage<boolean>("pyra:companion", true);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);
  }, [mode]);

  useEffect(() => {
    document.documentElement.setAttribute("data-accent", accent);
  }, [accent]);

  useEffect(() => {
    document.documentElement.style.setProperty("--display-brightness", String(brightness / 100));
  }, [brightness]);

  const setMode = useCallback((m: ThemeMode) => setModeRaw(m), [setModeRaw]);
  const toggleMode = useCallback(
    () => setModeRaw((prev) => (prev === "dark" ? "light" : "dark")),
    [setModeRaw]
  );
  const setBrightness = useCallback(
    (v: number) => setBrightnessRaw(Math.max(70, Math.min(100, v))),
    [setBrightnessRaw]
  );
  const setAccent = useCallback((a: AccentColor) => setAccentRaw(a), [setAccentRaw]);
  const setCompanion = useCallback((v: boolean) => setCompanionRaw(v), [setCompanionRaw]);

  return {
    mode,
    brightness,
    accent,
    companion,
    setMode,
    toggleMode,
    setBrightness,
    setAccent,
    setCompanion,
  };
}
