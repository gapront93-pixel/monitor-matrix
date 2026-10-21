import type { Metadata } from "next";

import { CompareView } from "@/components/compare/compare-view";
import { comparable, getCatalog } from "@/lib/catalog";
import { resLabel, specLine } from "@/lib/format";
import { fobDay, importStats } from "@/lib/import-stats";
import { catalogMessages } from "@/lib/i18n/messages/catalog";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT(catalogMessages)).compare.title };
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const { products, bySlug } = await getCatalog();
  const slugs = [...new Set((m ?? "").split(",").map((s) => decodeURIComponent(s.trim())).filter((s) => bySlug.has(s)))].slice(0, 4);
  const imports = await importStats(slugs.map((s) => bySlug.get(s)!));
  return (
    <CompareView
      items={slugs.map((s) => ({ ...comparable(bySlug.get(s)!), fobUsd: imports.get(s)?.fob ?? null, fobDate: fobDay(imports.get(s)?.fobDate ?? null) }))}
      choices={products.map((p) => ({ slug: p.slug, model: p.model, brand: p.brand, spec: [specLine(p), resLabel(p.resolution)].filter(Boolean).join(" · ") }))}
    />
  );
}
