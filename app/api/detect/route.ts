import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { runStep, sessionUploadDir } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 120;

// Accept an uploaded monitoring file, stash it under a fresh session id, and
// run ingest.py --detect to auto-detect column roles for the mapping UI. The
// file stays on disk so /api/analyze can reuse it without a re-upload.
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  const ext = path.extname(file.name).toLowerCase();
  if (![".csv", ".txt", ".tsv", ".parquet", ".pq", ".xlsx", ".xls"].includes(ext)) {
    return NextResponse.json({ error: `Unsupported file type ${ext}. Use CSV, Parquet or XLSX.` }, { status: 400 });
  }

  const sessionId = randomUUID();
  const dir = sessionUploadDir(sessionId);
  await fs.mkdir(dir, { recursive: true });
  const dest = path.join(dir, "monitoring" + ext);
  await fs.writeFile(dest, Buffer.from(await file.arrayBuffer()));

  let out = "";
  let err = "";
  try {
    const res = await runStep("ingest.py", ["--detect", dest], sessionId,
      (line) => {
        // ingest prints the JSON report on stdout; logs go to stderr (also piped)
        if (line.startsWith("{")) out = line;
        else err += line + "\n";
      },
      { timeoutMs: 120_000 });
    if (res.code !== 0 || !out) {
      return NextResponse.json({ error: `Detection failed.\n${err.slice(-500)}` }, { status: 500 });
    }
    const detection = JSON.parse(out);
    if (detection.error) {
      return NextResponse.json({ error: detection.error }, { status: 422 });
    }
    return NextResponse.json({ sessionId, fileName: file.name, detection });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
