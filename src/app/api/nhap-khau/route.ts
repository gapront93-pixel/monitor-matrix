import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse, type NextRequest } from "next/server";

import { userWith } from "@/lib/auth";

export const runtime = "nodejs";

// Import data for the "Xuất nhập khẩu" page: the normalised RAW rows (≈1.3 MB) and the static pivots of the workbook.
// Same rights as LCD sales (market data); files live outside public/ so the check cannot be skipped.
const FILES = { raw: "import-raw-2024-2026.json", piv: "pivots-static.json" } as const;
const cache = new Map<string, string>();

export async function GET(req: NextRequest) {
  if (!(await userWith("sales"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const f = req.nextUrl.searchParams.get("f");
  if (f !== "raw" && f !== "piv") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  let body = cache.get(f);
  if (!body) {
    body = await readFile(path.join(process.cwd(), "data", "import", FILES[f]), "utf8");
    cache.set(f, body);
  }
  return new Response(body, {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, max-age=3600" },
  });
}
