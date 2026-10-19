import { NextResponse, type NextRequest } from "next/server";

import { userWith } from "@/lib/auth";
import { importMessages } from "@/lib/i18n/messages/import";
import { getLocale } from "@/lib/i18n/server";
import { matchFileName } from "@/lib/image-names";
import { ImageError, saveProductImage } from "@/lib/images";
import { productIndex } from "@/lib/import/plan";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const MAX_FILES = 40; // the screen sends at most 10 per request

// Several photos at once, each matched to a model by its file name (MO27Q28G.jpg); or one photo for ?slug=
export async function POST(req: NextRequest) {
  const m = importMessages[await getLocale()].images;
  if (!(await userWith("images"))) return NextResponse.json({ error: m.noRight }, { status: 403 });
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const forSlug = form.get("slug");
  if (!files.length) return NextResponse.json({ error: m.noFiles }, { status: 400 });
  if (files.length > MAX_FILES) return NextResponse.json({ error: m.maxFiles(MAX_FILES) }, { status: 400 });

  const products = await prisma.product.findMany({ where: { hidden: false }, select: { id: true, slug: true, model: true, aliases: true } });
  const idx = productIndex(products);
  const byId = new Map(products.map((p) => [p.id, p]));
  const results: { file: string; ok: boolean; model?: string; slug?: string; error?: string }[] = [];

  for (const f of files) {
    const id = typeof forSlug === "string" && forSlug ? products.find((p) => p.slug === forSlug)?.id : matchFileName(f.name, idx);
    const prod = id ? byId.get(id) : undefined;
    if (!prod) {
      results.push({ file: f.name, ok: false, error: m.noMatch });
      continue;
    }
    try {
      await saveProductImage(prod.id, prod.slug, Buffer.from(await f.arrayBuffer()), { kind: "upload" }, m);
      results.push({ file: f.name, ok: true, model: prod.model, slug: prod.slug });
    } catch (e) {
      results.push({ file: f.name, ok: false, model: prod.model, error: e instanceof ImageError ? e.message : m.failed });
    }
  }
  return NextResponse.json({ results });
}
