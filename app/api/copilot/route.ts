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

  const [meta, ledger, causes] = await Promise.all([
    read("meta.json"),
    read("loss_ledger.json"),
    read("causes.json"),
  ]);

  const rows = ledger
    .map(
      (r: Record<string, unknown>, i: number) =>
        `${i + 1}. ${r.inverterId}: lost €${Math.round(Number(r.lostEur))}, ` +
        `health ${Math.round(Number(r.health) * 100)}%, cause ${r.topCause}, ` +
        `module ${r.moduleType}, ${r.kWp}kWp, ${r.errorCount} errors`
    )
    .join("\n");

  const text = `# PLANT DATA — ${meta.plant}
Inverters: ${meta.inverterCount} · Capacity: ${meta.totalKwp} kWp · Module types: ${meta.moduleTypes}
Period: ${meta.dateStart} → ${meta.dateEnd}
Total revenue lost (curtailment-adjusted): €${Math.round(meta.totalLostEur ?? 0)} / ${Math.round(meta.totalLostKwh ?? 0)} kWh
Worst inverter: ${meta.worstInverter}

## Loss ledger (ranked by lost revenue; "health" = actual ÷ expected power)
${rows}

## Cause definitions
- degradation: gradual yield decline vs the year-1 baseline
- outage: offline during production hours (model expects power, actual ~0)
- fault: recurring inverter error codes correlated with lost production
- curtailment: grid (EVU) or operator (DV) limited output — partly external
- unattributed: underperformance with no single dominant signal

Loss is computed as (expected − actual) energy over daylight, NON-curtailed intervals, valued at the per-week feed-in tariff. The expected-power model is trained per inverter on its first operating year.`;

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
