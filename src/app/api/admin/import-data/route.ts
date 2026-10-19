import { NextResponse, type NextRequest } from "next/server";

import { userWith } from "@/lib/auth";
import { importDataProblem } from "@/lib/import-convert";
import { importInfo, restoreImport, saveImport } from "@/lib/import-file";
import type { ImportData } from "@/lib/imports";

export const runtime = "nodejs";

// Replaces the import data with a file converted in the browser (the .xlsx is too heavy for the server's memory),
// or puts back a previous file. Mod and Admin (the same right as viewing the data).
export async function POST(req: NextRequest) {
  const me = await userWith("sales");
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as
    | { action: "upload"; fileName?: string; data?: unknown }
    | { action: "restore"; name?: string }
    | null;
  if (body?.action === "restore") {
    if (!body.name || !(await restoreImport(body.name))) return NextResponse.json({ error: "notFound" }, { status: 404 });
    return NextResponse.json({ ok: true, info: await importInfo() });
  }
  if (body?.action !== "upload") return NextResponse.json({ error: "badRequest" }, { status: 400 });
  const problem = importDataProblem(body.data);
  if (problem) return NextResponse.json({ error: "badData", detail: problem }, { status: 400 });
  await saveImport(body.data as ImportData, {
    fileName: String(body.fileName ?? "").slice(0, 200),
    uploadedAt: new Date().toISOString(),
    uploadedBy: me.name,
  });
  return NextResponse.json({ ok: true, info: await importInfo() });
}
