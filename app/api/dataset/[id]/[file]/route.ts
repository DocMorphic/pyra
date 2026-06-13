import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isValidSession } from "@/lib/pipeline";

export const runtime = "nodejs";

// Serve a session's artifact JSON from disk. Next only serves public/ files that
// existed at startup, so uploaded-session artifacts (created at runtime) must be
// streamed through this route instead of the static /artifacts path.
const FILE_RE = /^[a-z_]+\.json$/;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; file: string }> }
) {
  const { id, file } = await params;
  if (!isValidSession(id) || !FILE_RE.test(file)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const fp = path.join(process.cwd(), "public", "artifacts", "sessions", id, file);
  try {
    const body = await readFile(fp, "utf8");
    return new NextResponse(body, {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
