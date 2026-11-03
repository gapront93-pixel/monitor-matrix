import { NextResponse } from "next/server";

import { userWith } from "@/lib/auth";
import { currentScan, startScan } from "@/lib/crawl/job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Price scan of the dealer sites (Bảng giá › Quét giá). POST starts it in the background, GET reports progress.

export async function GET() {
  if (!(await userWith("prices"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ job: currentScan() }, { headers: { "cache-control": "no-store" } });
}

export async function POST() {
  const user = await userWith("prices");
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { job, started } = startScan(user);
  return NextResponse.json({ job, started }, { status: started ? 202 : 200 });
}
