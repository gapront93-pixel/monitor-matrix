import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { userWith } from "@/lib/auth";
import { importMessages } from "@/lib/i18n/messages/import";
import { getLocale } from "@/lib/i18n/server";
import { matchFileName } from "@/lib/image-names";
import { ImageError, imageFromLink } from "@/lib/images";
import { productIndex } from "@/lib/import/plan";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  // One "MODEL-CODE  https://…" per line, or a single url for `slug`
  text: z.string().max(20_000).default(""),
  slug: z.string().max(120).optional(),
  url: z.string().max(2000).optional(),
});

// Pasted image links: e.g. "Copy image address" on gigabyte.com in your own browser; the server downloads them
export async function POST(req: NextRequest) {
  const m = importMessages[await getLocale()].images;
  if (!(await userWith("images"))) return NextResponse.json({ error: m.noRight }, { status: 403 });
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: m.badBody }, { status: 400 });

  const products = await prisma.product.findMany({ select: { id: true, slug: true, model: true, aliases: true } });
  const idx = productIndex(products);
  const byId = new Map(products.map((x) => [x.id, x]));
  const jobs: { line: number; id: number | null; url: string | null; raw: string }[] = [];
  if (p.data.slug && p.data.url) {
    jobs.push({ line: 1, id: products.find((x) => x.slug === p.data.slug)?.id ?? null, url: p.data.url.trim(), raw: p.data.slug });
  } else {
    p.data.text.split(/\r?\n/).forEach((l, i) => {
      const t = l.trim();
      if (!t) return;
      const url = t.match(/https?:\/\/\S+/)?.[0] ?? null;
      const code = t.replace(url ?? "", "").replace(/[\s,;|\t]+$/, "").trim();
      jobs.push({ line: i + 1, id: code ? matchFileName(code, idx) : null, url, raw: code || t });
    });
  }

  const results: { line: number; ok: boolean; model?: string; error?: string }[] = [];
  for (const j of jobs.slice(0, 60)) {
    if (!j.id) {
      results.push({ line: j.line, ok: false, error: m.linkNoModel(j.line) });
      continue;
    }
    const prod = byId.get(j.id)!;
    if (!j.url) {
      results.push({ line: j.line, ok: false, model: prod.model, error: m.linkNoUrl(j.line) });
      continue;
    }
    try {
      await imageFromLink(prod, j.url, m);
      results.push({ line: j.line, ok: true, model: prod.model });
    } catch (e) {
      results.push({ line: j.line, ok: false, model: prod.model, error: e instanceof ImageError ? e.message : m.failed });
    }
  }
  return NextResponse.json({ results });
}
