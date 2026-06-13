"use client";

import { useRef, useState } from "react";
import { AppHeader, Button, SectionCard, Sticker } from "./_shared";
import { usePyraData } from "@/hooks/use-pyra-data";

type Stage = "upload" | "mapping" | "running" | "done" | "error";

interface ColInfo { name: string; samples: (string | null)[] }
interface InvMap { id: string; pac: string; idc: string | null; udc: string | null }
interface Proposed {
  timestamp: string; timestampFormat: string | null;
  irradiance: string | null; irradianceInferred?: boolean;
  module_temp: string | null; ambient_temp: string | null; altitude: string | null;
  evu: string | null; dv: string | null; plant_meter: string | null;
  inverters: InvMap[];
}
interface Detection {
  columns: ColInfo[]; proposed: Proposed;
  intervalH: number; intervalLabel: string; rowCount: number; spanDays: number; nInverters: number;
  notes: string[];
}
interface StepState { key: string; label: string; status: "pending" | "running" | "done" | "error"; }

const PLANT_ROLES: { key: keyof Proposed; label: string; required?: boolean }[] = [
  { key: "timestamp", label: "Timestamp", required: true },
  { key: "irradiance", label: "Irradiance (W/m²)", required: true },
  { key: "module_temp", label: "Module temp (°C)" },
  { key: "ambient_temp", label: "Ambient temp (°C)" },
  { key: "altitude", label: "Sun altitude (°)" },
  { key: "evu", label: "Grid avail. EVU (%)" },
  { key: "dv", label: "Operator avail. DV (%)" },
  { key: "plant_meter", label: "Plant meter P_AC (kW)" },
];

export function AddDatasetApp() {
  const { registerDataset } = usePyraData();
  const [stage, setStage] = useState<Stage>("upload");
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [fileName, setFileName] = useState("");
  const [det, setDet] = useState<Detection | null>(null);
  const [proposed, setProposed] = useState<Proposed | null>(null);
  const [label, setLabel] = useState("");
  const [lat, setLat] = useState("51.0");
  const [lon, setLon] = useState("10.0");
  const [tariff, setTariff] = useState("0.115");
  const [steps, setSteps] = useState<StepState[]>([]);
  const [lastLog, setLastLog] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(f: File) {
    setError(null);
    setStage("upload");
    setFileName(f.name);
    setLabel(f.name.replace(/\.[^.]+$/, ""));
    const fd = new FormData();
    fd.append("file", f);
    try {
      const res = await fetch("/api/detect", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Detection failed");
      setSessionId(j.sessionId);
      setDet(j.detection);
      setProposed(j.detection.proposed);
      setStage("mapping");
    } catch (e) {
      setError(String((e as Error).message ?? e));
      setStage("error");
    }
  }

  function setRole(key: keyof Proposed, val: string) {
    setProposed((p) => (p ? { ...p, [key]: val || null } : p));
  }

  async function run() {
    if (!proposed || !det) return;
    if (!proposed.timestamp || !proposed.irradiance || proposed.inverters.length === 0) {
      setError("Map at least a timestamp, irradiance and one inverter.");
      return;
    }
    setStage("running");
    setError(null);
    const mapping = {
      ...proposed,
      lat: parseFloat(lat) || 51, lon: parseFloat(lon) || 10,
      intervalH: det.intervalH, tariffEurPerKwh: parseFloat(tariff) || 0.115,
      label: label || fileName,
    };
    setSteps([]);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, mapping }),
      });
      if (!res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";
        for (const f of frames) handleFrame(f);
      }
    } catch (e) {
      setError(String((e as Error).message ?? e));
      setStage("error");
    }
  }

  function handleFrame(frame: string) {
    const ev = /event: (.*)/.exec(frame)?.[1]?.trim();
    const dataLine = /data: (.+)/.exec(frame)?.[1];
    if (!ev || !dataLine) return;
    let d: Record<string, unknown>;
    try { d = JSON.parse(dataLine); } catch { return; }
    if (ev === "start") {
      setSteps((d.steps as { key: string; label: string }[]).map((s) => ({ ...s, status: "pending" })));
    } else if (ev === "step") {
      setSteps((prev) => prev.map((s) => s.key === d.key ? { ...s, status: d.status as StepState["status"] } : s));
    } else if (ev === "log") {
      setLastLog(String(d.line ?? ""));
    } else if (ev === "done") {
      const id = String(d.sessionId);
      registerDataset({ id, base: `/api/dataset/${id}`, label: label || fileName });
      setStage("done");
    } else if (ev === "error") {
      setError(String(d.message ?? "Pipeline failed"));
      setStage("error");
    }
  }

  const cols = det?.columns.map((c) => c.name) ?? [];

  return (
    <div className="custom-scrollbar flex h-full flex-col overflow-y-auto">
      <AppHeader
        title="Add Dataset"
        subtitle="Upload your own PV monitoring export — Pyra detects the columns, runs the full pipeline, and tells you what each analysis needs."
        right={det && <Sticker color="var(--color-teal)">{det.nInverters} inverters · {det.intervalLabel}</Sticker>}
      />

      {error && (
        <div className="mb-3 rounded-md px-3 py-2 text-[12px]" style={{ background: "var(--color-info-box)", border: "1px solid var(--color-error)", color: "var(--color-error)" }}>
          {error}
        </div>
      )}

      {/* ---------- UPLOAD ---------- */}
      {(stage === "upload" || stage === "error") && !det && (
        <SectionCard title="1 · Upload monitoring data" color="#29dbbb">
          <input ref={fileRef} type="file" accept=".csv,.txt,.tsv,.parquet,.pq,.xlsx,.xls" hidden
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <button className="ph-btn" onClick={() => fileRef.current?.click()}>Choose file…</button>
          <div className="mt-2 text-[11px]" style={{ color: "var(--color-text-dim)" }}>
            CSV, Parquet or XLSX. Wide format: one timestamp column + per-inverter P_AC (and optionally I_DC/U_DC), plus an irradiance channel.
          </div>
        </SectionCard>
      )}

      {/* ---------- MAPPING ---------- */}
      {stage === "mapping" && det && proposed && (
        <>
          <SectionCard title="2 · Confirm column mapping" color="#f7a501">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {PLANT_ROLES.map((r) => (
                <label key={r.key} className="flex items-center justify-between gap-2 text-[11.5px]">
                  <span style={{ color: "var(--color-text-secondary)" }}>
                    {r.label}{r.required && <span style={{ color: "var(--color-error)" }}> *</span>}
                  </span>
                  <select
                    value={(proposed[r.key] as string) ?? ""}
                    onChange={(e) => setRole(r.key, e.target.value)}
                    className="font-mono max-w-[58%] rounded px-1.5 py-1 text-[11px] outline-none"
                    style={{ background: "var(--color-input-bg)", border: "1px solid var(--color-input-border)", color: "var(--color-text)" }}
                  >
                    <option value="">— none —</option>
                    {cols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className="mt-3 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
              {proposed.inverters.length} inverters detected (P_AC{proposed.inverters.some((i) => i.idc) ? " + DC current/voltage" : ", no DC telemetry"}).
            </div>
            {det.notes.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {det.notes.map((n, i) => (
                  <li key={i} className="text-[10.5px]" style={{ color: "var(--color-text-dim)" }}>· {n}</li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="3 · Plant settings" color="#2f80fa">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Dataset name" value={label} onChange={setLabel} />
              <Field label="Feed-in tariff (€/kWh)" value={tariff} onChange={setTariff} />
              <Field label="Latitude °N" value={lat} onChange={setLat} />
              <Field label="Longitude °E" value={lon} onChange={setLon} />
            </div>
            <div className="mt-2 text-[10.5px]" style={{ color: "var(--color-text-dim)" }}>
              Coordinates drive the clear-sky / solar-position model{proposed.altitude ? "" : " (used to synthesize sun altitude, since none was mapped)"}. kWp is estimated from peak power.
            </div>
          </SectionCard>

          <div className="mb-3 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setDet(null); setProposed(null); setStage("upload"); }}>Back</Button>
            <Button onClick={run}>Run pipeline →</Button>
          </div>
        </>
      )}

      {/* ---------- RUNNING / DONE ---------- */}
      {(stage === "running" || stage === "done") && (
        <SectionCard title={stage === "done" ? "Done ✓" : "Running the pipeline…"} color={stage === "done" ? "#6aa84f" : "#f1a82c"}>
          <div className="space-y-1.5">
            {steps.map((s) => (
              <div key={s.key} className="flex items-center gap-2.5 text-[12px]">
                <span style={{ width: 16, color: s.status === "done" ? "var(--color-success)" : s.status === "error" ? "var(--color-error)" : "var(--color-text-dim)" }}>
                  {s.status === "done" ? "✓" : s.status === "running" ? "▸" : s.status === "error" ? "✕" : "·"}
                </span>
                <span style={{ color: s.status === "running" ? "var(--color-text)" : "var(--color-text-muted)", fontWeight: s.status === "running" ? 600 : 400 }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
          {stage === "running" && lastLog && (
            <div className="font-mono mt-2 truncate text-[10px]" style={{ color: "var(--color-text-dim)" }}>{lastLog}</div>
          )}
          {stage === "done" && (
            <div className="mt-3 text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
              Dataset is now active — open the Loss Ledger, Inspector, Fleet Risk and the rest to explore it. Switch back to the demo from the menu bar.
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded px-2 py-1 text-[12px] outline-none"
        style={{ background: "var(--color-input-bg)", border: "1px solid var(--color-input-border)", color: "var(--color-text)" }}
      />
    </label>
  );
}
