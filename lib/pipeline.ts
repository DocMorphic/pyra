// Server-only helpers for running the Python pipeline on uploaded datasets.
// Used by app/api/detect and app/api/analyze. Never import from client code.
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

export const PROJECT_ROOT = process.cwd();
export const PIPELINE_DIR = path.join(PROJECT_ROOT, "pipeline");
export const UPLOADS_DIR = path.join(PIPELINE_DIR, "uploads");

/** Resolve the Python interpreter for the pipeline.
 * Defaults to the project venv; override with PYRA_PYTHON. We deliberately do
 * NOT fs-check the path here — an fs call on the constructed ".venv/bin/python"
 * makes Turbopack trace it as a build asset and panic on the venv symlink.
 * If the interpreter is missing, spawn() fails loudly with a clear error. */
// Spawn the BARE command "python3" — never a project path. Turbopack eagerly
// directory-traces ANY ".venv" path literal in bundled code and panics on the
// venv symlink, so we keep zero venv literals here: the venv's bin is put on
// PATH by the npm dev/start scripts and inherited by the spawned child.
// Override the interpreter with PYRA_PYTHON if needed.
function pythonCmd(): string {
  return process.env.PYRA_PYTHON || "python3";
}

const SESSION_RE = /^[a-f0-9-]{8,40}$/i;
export function isValidSession(id: string): boolean {
  return SESSION_RE.test(id);
}

export function sessionUploadDir(id: string): string {
  return path.join(UPLOADS_DIR, id);
}

export interface StepResult {
  code: number | null;
  killed: boolean;
}

/**
 * Spawn one pipeline script; forward each stdout/stderr line to onLog.
 * Resolves with the exit code; rejects only on spawn error. Honors a timeout
 * (SIGKILL). Exposes the child via onChild so the caller can kill on cancel.
 */
export function runStep(
  script: string,
  args: string[],
  sessionId: string,
  onLog: (line: string) => void,
  opts: { timeoutMs?: number; onChild?: (c: ChildProcess) => void } = {}
): Promise<StepResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonCmd(), [script, ...args], {
      cwd: PIPELINE_DIR,
      env: { ...process.env, PYRA_SESSION: sessionId },
    });
    opts.onChild?.(child);

    let killed = false;
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          killed = true;
          child.kill("SIGKILL");
        }, opts.timeoutMs)
      : null;

    let buf = "";
    const pump = (chunk: Buffer) => {
      buf += chunk.toString();
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (line) onLog(line);
      }
    };
    child.stdout.on("data", pump);
    child.stderr.on("data", pump);
    child.on("error", (e) => {
      if (timer) clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (buf.trim()) onLog(buf.trim());
      resolve({ code, killed });
    });
  });
}

/** The session pipeline DAG (soiling is demo-only — needs a 2nd plant). */
export function pipelineSteps(uploadFile: string, mappingPath: string) {
  return [
    { key: "ingest", label: "Normalizing dataset", script: "ingest.py",
      args: ["--normalize", uploadFile, "--mapping", mappingPath], timeoutMs: 240_000 },
    { key: "build", label: "Building tidy tables", script: "build.py", args: [], timeoutMs: 300_000 },
    { key: "analytics", label: "Training expected-power models", script: "analytics.py", args: [], timeoutMs: 600_000 },
    { key: "dc_diag", label: "DC / string diagnostics", script: "dc_diag.py", args: [], timeoutMs: 180_000 },
    { key: "faults", label: "Fault timeline", script: "faults.py", args: [], timeoutMs: 120_000 },
    { key: "fault_econ", label: "Fault economics", script: "fault_econ.py", args: [], timeoutMs: 180_000 },
    { key: "risk", label: "Failure-risk scoring", script: "risk.py", args: [], timeoutMs: 120_000 },
    { key: "simulator", label: "What-if precompute", script: "simulator.py", args: [], timeoutMs: 120_000 },
  ];
}
