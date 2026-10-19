import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { userWith } from "@/lib/auth";
import { getCatalog } from "@/lib/catalog";
import { resLabel, specLine } from "@/lib/format";
import { normKey } from "@/lib/normalize";

const Query = z.object({ q: z.string().trim().min(1).max(60) });

// Quick search in the header: model code, slug or brand + model
export async function GET(req: NextRequest) {
  if (!(await userWith("view"))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = Query.safeParse({ q: req.nextUrl.searchParams.get("q") ?? "" });
  if (!parsed.success) return NextResponse.json({ hits: [] });
  const key = normKey(parsed.data.q);
  if (!key) return NextResponse.json({ hits: [] });

  const { products } = await getCatalog();
  const scored = products
    .map((p) => {
      const m = normKey(p.model);
      const full = normKey(`${p.brand} ${p.model}`);
      const s = normKey(p.slug);
      const score = m.startsWith(key) || s.startsWith(key) ? 0 : m.includes(key) || s.includes(key) ? 1 : full.includes(key) ? 2 : -1;
      return { p, score };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => a.score - b.score || Number(b.p.isGigabyte) - Number(a.p.isGigabyte) || a.p.model.length - b.p.model.length)
    .slice(0, 7);

  return NextResponse.json({
    hits: scored.map(({ p }) => ({
      slug: p.slug,
      model: p.model,
      brand: p.brand,
      spec: [specLine(p), resLabel(p.resolution)].filter(Boolean).join(" · "),
      minPrice: p.minPrice,
    })),
  });
}
