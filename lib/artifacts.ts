// Shapes of the JSON artifacts emitted by the Python pipeline into
// app/public/artifacts/ (served at /artifacts/*.json).

export interface PlantMeta {
  plant: string;
  inverterCount: number;
  totalKwp: number;
  moduleTypes: number;
  dateStart: string;
  dateEnd: string;
  totalLostEur?: number;
  totalLostKwh?: number;
  worstInverter?: string;
}

export interface InverterInfo {
  inverterId: string;
  area: string;
  moduleType: string;
  kWp: number | null;
  strings: number | null;
  modules: number | null;
  lifetimeKwh: number;
}

export type Cause = "degradation" | "outage" | "curtailment" | "fault" | "unknown";

export interface LedgerEntry {
  inverterId: string;
  lostKwh: number;
  lostEur: number;
  health: number;
  topCause: Cause;
  moduleType: string | null;
  kWp: number | null;
  errorCount: number;
}

export interface YearPoint {
  year: number;
  pr: number;
  norm: number;
}

export interface MonthPoint {
  t: string; // YYYY-MM
  actual: number;
  expected: number;
}

export interface Performance {
  years: YearPoint[];
  monthly: MonthPoint[];
}

export interface FaultSummary {
  total: number;
  monthly: { t: string; count: number }[];
  topCodes: { code: string; description: string; count: number }[];
}

export interface TicketEntry {
  start: string | null;
  end: string | null;
  component: string | null;
  category: string | null;
}

export interface ArtifactBundle {
  meta: PlantMeta;
  inverters: InverterInfo[];
  ledger: LedgerEntry[];
  performance: Record<string, Performance>;
  causes: Record<string, Cause>;
  faults: Record<string, FaultSummary>;
  tickets: TicketEntry[];
}

const BASE = "/artifacts";

export async function loadArtifacts(): Promise<ArtifactBundle> {
  const [meta, inverters, ledger, performance, causes, faults, tickets] = await Promise.all([
    fetchJson<PlantMeta>("meta.json"),
    fetchJson<InverterInfo[]>("inverters.json"),
    fetchJson<LedgerEntry[]>("loss_ledger.json"),
    fetchJson<Record<string, Performance>>("performance.json"),
    fetchJson<Record<string, Cause>>("causes.json"),
    fetchJson<Record<string, FaultSummary>>("faults.json"),
    fetchJson<TicketEntry[]>("tickets.json"),
  ]);
  return { meta, inverters, ledger, performance, causes, faults, tickets };
}

async function fetchJson<T>(name: string): Promise<T> {
  const res = await fetch(`${BASE}/${name}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${name} (${res.status})`);
  return res.json() as Promise<T>;
}

export const CAUSE_LABEL: Record<Cause, string> = {
  degradation: "Degradation",
  outage: "Outage",
  curtailment: "Curtailment",
  fault: "Fault",
  unknown: "Unattributed",
};

// PostHog categorical palette.
export const CAUSE_COLOR: Record<Cause, string> = {
  degradation: "#dc9300", // yellow
  outage: "#d7373f", // red
  curtailment: "#1d4aff", // blue
  fault: "#8f4fe8", // violet
  unknown: "var(--color-text-dim)",
};

export const eur = (n: number) =>
  "€" + Math.round(n).toLocaleString("en-US");

export const kwh = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(2) + " GWh";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + " MWh";
  return Math.round(n) + " kWh";
};

/** Health → color ramp (green healthy → red bad). */
export function healthColor(h: number): string {
  if (h >= 0.95) return "#2f9e44";
  if (h >= 0.9) return "#74b816";
  if (h >= 0.8) return "#dc9300";
  if (h >= 0.65) return "#f76808";
  return "#d7373f";
}
