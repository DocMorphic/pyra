import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

// Sonnet 4.6 — snappy for interactive grounded Q&A. Swap to claude-opus-4-8
// for maximum reasoning depth at higher latency.
const MODEL = "claude-sonnet-4-6";

const INSTRUCTIONS = `You are Pyra's O&M Copilot — an assistant for a solar-plant operations team.
Answer ONLY from the PLANT DATA provided below. If the data doesn't cover the question, say so.
Be concise and quantitative: cite inverter IDs, euros (€), kWh/MWh, health %, and causes.
Frame answers as an O&M engineer would — what happened, why, the financial impact, and the recommended action.
You can answer: which inverter to service first (risk scores), what fixing a cause would recover (what-if buckets),
fault-category costs, DC/string disconnects, and Plant B soiling. Prefer the most specific block.
Do not invent numbers. Keep answers under ~150 words unless asked for detail.`;

interface ArtifactCtx {
  text: string;
  builtAt: number;
}
let cached: ArtifactCtx | null = null;

async function buildContext(): Promise<string> {
  // Re-read at most once a minute; the artifact JSON is byte-stable between
  // pipeline runs, so the cached system prefix keeps hitting the prompt cache.
  if (cached && Date.now() - cached.builtAt < 60_000) return cached.text;

  const dir = path.join(process.cwd(), "public", "artifacts");
  const read = async (f: string) =>
    JSON.parse(await readFile(path.join(dir, f), "utf8"));

  const [meta, ledger, causes, metrics, degradation, dc, faultEcon, risk, simulator, soiling] =
    await Promise.all([
      read("meta.json"),
      read("loss_ledger.json"),
      read("causes.json"),
      read("model_metrics.json"),
      read("degradation.json"),
      read("dc_diag.json"),
      read("fault_econ.json"),
      read("risk.json"),
      read("simulator.json"),
      read("soiling.json"),
    ]);

  const rows = ledger
    .map(
      (r: Record<string, unknown>, i: number) =>
        `${i + 1}. ${r.inverterId}: lost €${Math.round(Number(r.lostEur))} ` +
        `(95% CI €${Math.round(Number(r.lostEurLo))}–€${Math.round(Number(r.lostEurHi))}), ` +
        `health ${Math.round(Number(r.health) * 100)}%, degradation ${r.degradationRate ?? "?"}%/yr, ` +
        `cause ${r.topCause}${r.onset ? ` (onset ${r.onset})` : ""}, ` +
        `module ${r.moduleType}, ${r.kWp}kWp, ${r.errorCount} errors`
    )
    .join("\n");

  const mtRows = Object.entries(degradation.byModuleType || {})
    .map(([t, raw]) => {
      const v = raw as Record<string, unknown>;
      return `- ${t}: ${v.count} inverters, median health ${v.medianHealth}, median degradation ${v.medianDegradationRate}%/yr, €${Math.round(Number(v.lostEur))} lost`;
    })
    .join("\n");

  const recon = metrics.reconciliation;
  const loc = metrics.location;

  // --- Phase 7 deep-analytics context blocks ---
  const faultRows = (faultEcon.categories || [])
    .filter((c: Record<string, unknown>) => c.category !== "unattributed")
    .map((c: Record<string, unknown>) =>
      `- ${c.label}: ${c.events} onsets on ${c.invertersAffected} inverters → €${Math.round(Number(c.lostEur))} lost`)
    .join("\n");

  const riskRows = (risk.ranked || []).slice(0, 12)
    .map((id: string, i: number) => {
      const r = risk.perInverter[id] as Record<string, unknown>;
      const drv = ((r.drivers as { label: string }[]) || []).map((d) => d.label).join(", ");
      return `${i + 1}. ${id}: risk ${r.risk}/100, health ${Math.round(Number(r.health) * 100)}%, ${r.recentErrors12mo} errors/12mo, ${r.tickets} tickets [${drv}]`;
    })
    .join("\n");

  const tl = risk.ticketLink || {};
  const simByCause = simulator.fleetByCause || {};
  const dcTop = Object.entries(dc.perInverter || {})
    .filter(([, v]) => (v as Record<string, unknown>).dcLostKwh as number > 0)
    .sort((a, b) => (Number((b[1] as Record<string, unknown>).dcLostKwh)) - (Number((a[1] as Record<string, unknown>).dcLostKwh)))
    .slice(0, 6)
    .map(([id, v]) => {
      const x = v as Record<string, unknown>;
      return `- ${id}: ${(x.episodes as unknown[]).length} disconnect event(s), ${Math.round(Number(x.dcLostKwh))} kWh lost, DC→AC eff ${(Number(x.meanEff) * 100).toFixed(1)}%`;
    })
    .join("\n");

  const text = `# PLANT DATA — ${meta.plant}
Inverters: ${meta.inverterCount} · Capacity: ${meta.totalKwp} kWp · Module types: ${meta.moduleTypes}
Period: ${meta.dateStart} → ${meta.dateEnd}
Location (recovered from solar-elevation telemetry): ${loc ? `${loc.lat}°N, ${loc.lon}°E` : "n/a"}
Total revenue lost (curtailment-adjusted): €${Math.round(meta.totalLostEur ?? 0)} / ${Math.round(meta.totalLostKwh ?? 0)} kWh
Of which recoverable via O&M: €${Math.round(meta.recoverableEur ?? 0)}; permanent (degradation): €${Math.round(meta.permanentEur ?? 0)}
Worst inverter: ${meta.worstInverter}

## Model validation (credibility)
- Expected-power: per-inverter ML trained on year 1; mean out-of-sample R² ${meta.meanModelR2 ?? "?"}
- Independent pvlib physics cross-check agreement (median): ${metrics.medianPhysicsAgreement ?? "?"}×
- Plant-meter reconciliation: Σinverters ÷ grid-feed meter = ${recon ? recon.ratio : "?"}× (≈ transformer loss)

## Loss ledger (ranked by lost revenue; "health" = actual ÷ expected power)
${rows}

## Degradation by module type
${mtRows}

## Fault economics (validated loss attributed to error-code categories)
${faultRows}
Total fault-attributed: €${Math.round(faultEcon.totalAttributedEur)} of €${Math.round(faultEcon.totalLossEur)} (${Math.round(faultEcon.attributedFraction * 100)}%); the rest is gradual degradation/soiling. ${faultEcon.totalOnsets} fault onsets total.

## DC / string diagnostics (from per-inverter I_DC_SUM + U_DC)
${dc.totalDisconnectEpisodes} discrete DC-disconnect events (current→0, voltage healthy) across ${dc.invertersWithDisconnects} inverters; ${Math.round(dc.totalDcLostKwh)} kWh lost. Worst:
${dcTop}

## Failure-risk / service priority (as of ${risk.asOf}; score 0–100)
${riskRows}
Ticket validation: ${tl.withPrecedingErrors}/${tl.linkedTickets} inverter-named O&M tickets were preceded by our error onsets (median lead ${tl.medianLeadDays} days) — the twin predicts failures before maintenance is logged.

## What-if recoverable loss (mutually-exclusive buckets, sum to the ledger)
DC €${Math.round(simByCause.dc?.eur ?? 0)} · Outage €${Math.round(simByCause.outage?.eur ?? 0)} · Fault €${Math.round(simByCause.fault?.eur ?? 0)} · Degradation €${Math.round(simByCause.degradation?.eur ?? 0)}.
Operationally recoverable (DC+outage+fault): €${Math.round(simulator.fleetRecoverableEur)} of €${Math.round(simulator.fleetTotalLossEur)} total.

## Plant B soiling (${soiling.coords.lat}°N, ${soiling.coords.lon}°E; ${soiling.kWp} kWp)
Soiling rate ≈ ${soiling.soilingRatePctPerDay}%/day; mean soiling loss ${soiling.totalSoilingLossPct}% → ~${Math.round(soiling.annualSoilingLossKwh)} kWh/yr (€${Math.round(soiling.annualSoilingLossEur)}). ${soiling.episodes.length} episodes, clustering in spring/summer (pollen), rain-reset. Detected via pvlib clear-sky temperature-corrected PR.

## Cause definitions
- degradation: gradual yield decline vs the year-1 baseline (permanent)
- outage: offline during production hours (model expects power, actual ~0)
- fault: recurring inverter error codes correlated with lost production
- curtailment: grid (EVU) or operator (DV) limited output — partly external
- unattributed: underperformance with no single dominant signal

Loss = (expected − actual) energy over daylight, NON-curtailed intervals (EVU/DV excluded), valued at the per-week feed-in tariff, with a 95% confidence interval. The expected-power model is trained per inverter on its first operating year and cross-checked with pvlib physics.`;

  cached = { text, builtAt: Date.now() };
  return text;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set. Add it to .env.local and restart." },
      { status: 503 }
    );
  }

  let body: { messages?: { role: "user" | "assistant"; text: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const history = (body.messages ?? []).filter((m) => m.text?.trim());
  if (history.length === 0) {
    return NextResponse.json({ error: "No message provided" }, { status: 400 });
  }

  const dataContext = await buildContext();
  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      thinking: { type: "disabled" },
      system: [
        { type: "text", text: INSTRUCTIONS },
        // Stable data block carries the cache breakpoint — caches the whole
        // system prefix; the volatile question stays in `messages`.
        { type: "text", text: dataContext, cache_control: { type: "ephemeral" } },
      ],
      messages: history.map((m) => ({ role: m.role, content: m.text })),
    });

    const reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return NextResponse.json({ reply, cached: response.usage.cache_read_input_tokens ?? 0 });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Claude API error: ${err.message}` }, { status: err.status ?? 500 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
