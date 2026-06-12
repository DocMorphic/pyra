import type { AppDefinition } from "./types";

export const STORAGE_PREFIX = "pyra";

export const STORAGE_KEYS = {
  theme: `${STORAGE_PREFIX}:theme`,
  brightness: `${STORAGE_PREFIX}:brightness`,
  accent: `${STORAGE_PREFIX}:accent`,
} as const;

export const DEFAULT_THEME = {
  // PostHog-style cream light mode by default; dark available via toggle.
  mode: "light" as const,
  brightness: 100,
};

// =====================================================================
// Pyra app registry — the PyraOS desktop apps
// =====================================================================
export const APP_REGISTRY: Record<string, AppDefinition> = {
  "plant-map": {
    id: "plant-map",
    title: "Plant Map",
    icon: "🗺️",
    defaultWidth: 760,
    defaultHeight: 560,
    defaultX: 80,
    defaultY: 70,
    showInExplorer: true,
    showInTaskbar: true,
  },
  "loss-ledger": {
    id: "loss-ledger",
    title: "Loss Ledger",
    icon: "💶",
    defaultWidth: 560,
    defaultHeight: 600,
    defaultX: 880,
    defaultY: 70,
    showInExplorer: true,
    showInTaskbar: true,
  },
  inspector: {
    id: "inspector",
    title: "Inverter Inspector",
    icon: "🔬",
    defaultWidth: 820,
    defaultHeight: 600,
    defaultX: 220,
    defaultY: 110,
    showInExplorer: true,
    showInTaskbar: true,
  },
  timeline: {
    id: "timeline",
    title: "Fault Timeline",
    icon: "📈",
    defaultWidth: 880,
    defaultHeight: 540,
    defaultX: 180,
    defaultY: 90,
    showInExplorer: true,
    showInTaskbar: true,
  },
  copilot: {
    id: "copilot",
    title: "O&M Copilot",
    icon: "🤖",
    defaultWidth: 460,
    defaultHeight: 620,
    defaultX: 1000,
    defaultY: 90,
    showInExplorer: true,
    showInTaskbar: true,
  },
  methods: {
    id: "methods",
    title: "Methods & Validation",
    icon: "🔬",
    defaultWidth: 600,
    defaultHeight: 640,
    defaultX: 300,
    defaultY: 80,
    showInExplorer: true,
    showInTaskbar: true,
  },
  report: {
    id: "report",
    title: "Executive Report",
    icon: "📄",
    defaultWidth: 720,
    defaultHeight: 640,
    defaultX: 260,
    defaultY: 80,
    showInExplorer: true,
    showInTaskbar: true,
    noContentPadding: true,
  },
  settings: {
    id: "settings",
    title: "Settings",
    icon: "⚙️",
    defaultWidth: 480,
    defaultHeight: 400,
    defaultX: 360,
    defaultY: 120,
    showInExplorer: true,
    showInTaskbar: true,
  },
  about: {
    id: "about",
    title: "About Pyra",
    icon: "☀️",
    defaultWidth: 520,
    defaultHeight: 460,
    defaultX: 340,
    defaultY: 110,
    showInExplorer: true,
    showInTaskbar: true,
  },
};

// =====================================================================
// AI model selection — change here to swap models project-wide.
// =====================================================================
export const MODELS = {
  fast: "claude-haiku-4-5",
  reason: "claude-sonnet-4-6",
} as const;
