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
  return new Response(text, {
    // Revalidated on every load: a new upload must show at once (the ETag keeps repeat loads cheap)
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-cache", ETag: `"${Math.round(mtime)}"` },
  });
}
