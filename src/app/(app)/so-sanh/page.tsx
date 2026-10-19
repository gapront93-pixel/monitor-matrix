import type { Metadata } from "next";

import { CompareView } from "@/components/compare/compare-view";
import { comparable, getCatalog } from "@/lib/catalog";
import { resLabel, specLine } from "@/lib/format";

export const metadata: Metadata = { title: "So sánh" };

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const { products, bySlug } = await getCatalog();
  const slugs = [...new Set((m ?? "").split(",").map((s) => decodeURIComponent(s.trim())).filter((s) => bySlug.has(s)))].slice(0, 4);
  return (
    <CompareView
      items={slugs.map((s) => comparable(bySlug.get(s)!))}
      choices={products.map((p) => ({ slug: p.slug, model: p.model, brand: p.brand, spec: [specLine(p), resLabel(p.resolution)].filter(Boolean).join(" · ") }))}
    />
  );
}
