// Shapes of the JSON artifacts emitted by the Python pipeline into
// app/public/artifacts/ (served at /artifacts/*.json).

export interface PlantLocation {
  lat: number;
  lon: number;
  rmse_deg?: number;
  source: string;
}

export interface PlantMeta {
  plant: string;
  inverterCount: number;
  totalKwp: number;
  moduleTypes: number;
  dateStart: string;
  dateEnd: string;
  totalLostEur?: number;
  totalLostKwh?: number;
  recoverableEur?: number;
  permanentEur?: number;
  worstInverter?: string;
  meanModelR2?: number;
  location?: PlantLocation;
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
  lostEurLo: number;
  lostEurHi: number;
  health: number;
  degradationRate: number | null; // %/yr (negative = degrading)
  topCause: Cause;
  onset: string | null;           // YYYY-MM
  recoverableEur: number;
  permanentEur: number;
  peerDelta: number;
  moduleType: string | null;
  kWp: number | null;
  errorCount: number;
  modelR2: number | null;
}

export interface YearPoint {
  year: number;
  pr: number | null;
  prTc: number | null;
  norm: number | null;
}

export interface MonthPoint {
  t: string; // YYYY-MM
  actual: number;
  expected: number;
  lo: number;
  hi: number;
}

export interface Performance {
  years: YearPoint[];
  monthly: MonthPoint[];
  onset: string | null;
}

export interface ModuleTypeAgg {
  count: number;
  medianHealth: number;
  medianDegradationRate: number | null;
  lostEur: number;
  kWp: number;
}

export interface ModelMetrics {
  location: PlantLocation;
  perInverter: Record<string, {
    r2: number | null; mae: number | null; mbe: number | null;
    relSigma: number; physicsAgreement: number | null; degradationRate: number | null;
  }>;
  meanR2: number | null;
  medianPhysicsAgreement: number | null;
  reconciliation: { inverterSumKwh: number; plantMeterKwh: number; ratio: number } | null;
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
  metrics: ModelMetrics;
  moduleTypes: Record<string, ModuleTypeAgg>;
}

const BASE = "/artifacts";

export async function loadArtifacts(): Promise<ArtifactBundle> {
  const [meta, inverters, ledger, performance, causes, faults, tickets, metrics, degradation] =
    await Promise.all([
      fetchJson<PlantMeta>("meta.json"),
      fetchJson<InverterInfo[]>("inverters.json"),
      fetchJson<LedgerEntry[]>("loss_ledger.json"),
      fetchJson<Record<string, Performance>>("performance.json"),
      fetchJson<Record<string, Cause>>("causes.json"),
      fetchJson<Record<string, FaultSummary>>("faults.json"),
      fetchJson<TicketEntry[]>("tickets.json"),
      fetchJson<ModelMetrics>("model_metrics.json"),
      fetchJson<{ byModuleType: Record<string, ModuleTypeAgg> }>("degradation.json"),
    ]);
  return {
    meta, inverters, ledger, performance, causes, faults, tickets,
    metrics, moduleTypes: degradation.byModuleType,
  };
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

// PostHog bright categorical palette.
export const CAUSE_COLOR: Record<Cause, string> = {
  degradation: "#f7a501", // yellow
  outage: "#f35454", // salmon
  curtailment: "#2f80fa", // blue
  fault: "#b62ad9", // purple
  unknown: "var(--color-text-dim)",
};

export const eur = (n: number) =>
  "€" + Math.round(n).toLocaleString("en-US");

export const kwh = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(2) + " GWh";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + " MWh";
  return Math.round(n) + " kWh";
};

/** Health → color ramp (green healthy → red bad), PostHog palette. */
export function healthColor(h: number): string {
  if (h >= 0.95) return "#6aa84f";
  if (h >= 0.9) return "#9bbf3a";
  if (h >= 0.8) return "#f7a501";
  if (h >= 0.65) return "#eb6e2a";
  return "#f35454";
}
