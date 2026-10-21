import { NextResponse, type NextRequest } from "next/server";

import { userWith } from "@/lib/auth";
import { readImport } from "@/lib/import-file";

export const runtime = "nodejs";

// Import data for the "Import Data - LCD" page: the normalised RAW rows (≈1.3 MB); every table is computed from them.
// Same rights as LCD sales (market data); the file lives outside public/ so the check cannot be skipped.
export async function GET(req: NextRequest) {
  if (!(await userWith("sales"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (req.nextUrl.searchParams.get("f") !== "raw") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { text, mtime } = await readImport();
  // Revalidated on every load: a new upload must show at once; until then the browser's copy is reused (304, no body)
  const etag = `"${Math.round(mtime)}"`;
  const headers = { "Cache-Control": "private, no-cache", ETag: etag };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(text, { headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
}
