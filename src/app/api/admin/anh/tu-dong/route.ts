import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { userWith } from "@/lib/auth";
import { autoFetchImage } from "@/lib/images";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  // missing: only models without a photo; refresh: also re-fetch photos that came from a dealer (uploads are never replaced)
  mode: z.enum(["missing", "refresh"]).default("missing"),
  scope: z.enum(["gigabyte", "all"]).default("gigabyte"),
  // Models this run already handled (done or failed), sent back by the screen
  skip: z.array(z.string().max(120)).max(500).default([]),
  slug: z.string().max(120).optional(),
});

const BATCH = 4;

// One small batch per call, so the admin screen can show progress and no request runs for minutes
export async function POST(req: NextRequest) {
  if (!(await userWith("images"))) return NextResponse.json({ error: "Bạn không có quyền quản lý ảnh." }, { status: 403 });
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  const { mode, scope, skip, slug } = p.data;

  const where = slug
    ? { slug }
    : {
        ...(scope === "gigabyte" ? { isGigabyte: true } : {}),
        ...(mode === "missing" ? { imageFile: null } : { OR: [{ imageFile: null }, { NOT: { imageSource: "upload" } }] }),
        slug: { notIn: skip },
      };
  const todo = await prisma.product.findMany({
    where,
    orderBy: [{ isGigabyte: "desc" }, { model: "asc" }],
    select: { id: true, slug: true, model: true, isGigabyte: true, url: true },
  });
  const batch = todo.slice(0, slug ? 1 : BATCH);
  const results = [];
  for (const prod of batch) results.push({ slug: prod.slug, model: prod.model, ...(await autoFetchImage(prod)) });
  const remaining = todo.length - batch.length;
  return NextResponse.json({ results, remaining, done: remaining <= 0 });
}
