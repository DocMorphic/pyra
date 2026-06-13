import { NextResponse } from "next/server";
import type { ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { runStep, pipelineSteps, sessionUploadDir, isValidSession } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 900;

// One CPU-heavy pipeline at a time (analytics trains a model per inverter).
let running = false;

// Stream the full pipeline for an uploaded session as Server-Sent Events.
// Body: { sessionId, mapping }. The file was stored by /api/detect.
export async function POST(req: Request) {
  let body: { sessionId?: string; mapping?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { sessionId, mapping } = body;
  if (!sessionId || !isValidSession(sessionId)) {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
  }
  if (!mapping || !mapping.timestamp || !Array.isArray(mapping.inverters) || mapping.inverters.length === 0) {
    return NextResponse.json({ error: "Mapping must include a timestamp and at least one inverter" }, { status: 400 });
  }
  const dir = sessionUploadDir(sessionId);
  const upload = fsSync.existsSync(dir)
    ? fsSync.readdirSync(dir).find((f) => f.startsWith("monitoring."))
    : undefined;
  if (!upload) {
    return NextResponse.json({ error: "Upload not found — re-detect the file first" }, { status: 404 });
  }
  if (running) {
    return NextResponse.json({ error: "A pipeline is already running. Try again shortly." }, { status: 429 });
  }

  const uploadPath = path.join(dir, upload);
  const mappingPath = path.join(dir, "mapping.json");
  await fs.writeFile(mappingPath, JSON.stringify(mapping));

  const steps = pipelineSteps(uploadPath, mappingPath);
  const encoder = new TextEncoder();
  let current: ChildProcess | null = null;
  running = true;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        send("start", { sessionId, steps: steps.map((s) => ({ key: s.key, label: s.label })) });
        for (let i = 0; i < steps.length; i++) {
          const s = steps[i];
          send("step", { key: s.key, label: s.label, status: "running", i: i + 1, n: steps.length });
          const res = await runStep(s.script, s.args, sessionId,
            (line) => send("log", { key: s.key, line }),
            { timeoutMs: s.timeoutMs, onChild: (c) => (current = c) });
          if (res.code !== 0) {
            send("step", { key: s.key, status: "error", code: res.code, killed: res.killed });
            send("error", { key: s.key, message: res.killed ? "step timed out" : `step failed (exit ${res.code})` });
            controller.close();
            return;
          }
          send("step", { key: s.key, status: "done", i: i + 1, n: steps.length });
        }
        send("done", { sessionId });
      } catch (e) {
        send("error", { message: String(e) });
      } finally {
        running = false;
        current = null;
        controller.close();
      }
    },
    cancel() {
      // client disconnected — kill the live child and free the slot
      current?.kill("SIGKILL");
      running = false;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
    },
  });
}
