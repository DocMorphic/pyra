// =====================================================================
// Pyra — domain types
// =====================================================================

// === Theme / chrome ===
export type ThemeMode = "light" | "dark";

export interface ThemeState {
  mode: ThemeMode;
  brightness: number;
}

export interface WindowState {
  appId: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
  preMaxPosition?: { x: number; y: number };
  preMaxSize?: { width: number; height: number };
}

export interface AppDefinition {
  id: string;
  title: string;
  icon: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultX: number;
  defaultY: number;
  showInExplorer: boolean;
  showInTaskbar: boolean;
  /** Render the app component flush against the window edges (no inner padding). */
  noContentPadding?: boolean;
}

/** Data that flows with a window — e.g. focusing a specific inverter
 *  when opening the Inspector from the Loss Ledger or Plant Map. */
export interface WindowContext {
  inverterId?: string;
}

// =====================================================================
// Pyra — solar-plant domain (artifact shapes emitted by the pipeline)
// =====================================================================

export interface InverterMeta {
  inverterId: string;        // "INV 01.01.001"
  area: string;              // "01"
  moduleType: string;
  kWp: number;
  strings?: number;
  modules?: number;
}

/** One row of the ranked Loss Ledger — the money headline. */
export interface LossLedgerEntry {
  inverterId: string;
  lostKwh: number;
  lostEur: number;
  /** Normalized yield vs peer median, 0–1 (1 = healthy). */
  health: number;
  /** Coarse driver attribution for the loss. */
  topCause?: "degradation" | "outage" | "curtailment" | "fault" | "unknown";
  moduleType?: string;
  kWp?: number;
}

export interface ErrorEvent {
  ts: string;
  inverterId?: string;
  component?: string;
  hexCode: string;
  decimalCode?: number;
  description: string;       // German description from translation table
}

export interface Ticket {
  start: string;
  end?: string;
  category: string;
}

/** Per-inverter expected-vs-actual series point (downsampled for the UI). */
export interface InspectorPoint {
  ts: string;
  actual: number;            // measured P_AC (kW)
  expected: number;          // model prediction (kW)
  irradiance?: number;
}

export interface DegradationPoint {
  year: number;
  normalizedYield: number;   // vs year-1 baseline, 1.0 = no degradation
}
