import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import Link from "next/link";

import { BenchmarkCards } from "@/components/benchmark-cards";
import { RivalsTable, SegmentSelect } from "@/components/rivals/rivals-table";
import { PageHeader, Panel, VerdictTag, verdictDot } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { comparable, getCatalog } from "@/lib/catalog";
import { byRivalBrand } from "@/lib/format";
import { catalogMessages } from "@/lib/i18n/messages/catalog";
import { getT } from "@/lib/i18n/server";
import { segmentBenchmarks } from "@/lib/product-detail";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT(catalogMessages)).rivals.title };
}

export default async function RivalsPage({ searchParams }: { searchParams: Promise<{ pk?: string }> }) {
  const { pk } = await searchParams;
  const [{ segments, products }, m] = await Promise.all([getCatalog(), getT(catalogMessages)]);
  const t = m.rivals;
  if (!segments.length) {
    return (
      <>
        <PageHeader eyebrow={t.title} title={t.heading} />
        <EmptyState title={t.noSegments}>{t.noSegmentsText}</EmptyState>
      </>
    );
  }
  const seg = segments.find((s) => s.id === pk) ?? segments[0];
  const inSeg = products.filter((p) => p.segmentId === seg.id);
  const items = [...inSeg.filter((p) => p.isGigabyte), ...inSeg.filter((p) => !p.isGigabyte).sort(byRivalBrand)].map(comparable);
  const benchmarks = await segmentBenchmarks(seg.id);

  return (
    <>
      <PageHeader eyebrow={t.title} title={t.heading} />
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <nav aria-label={t.segments} className="hidden w-[260px] shrink-0 overflow-hidden rounded-panel border border-line bg-panel md:sticky md:top-[70px] md:block">
          {segments.map((s) => (
            <Link
              key={s.id}
              href={`/doi-thu?pk=${s.id}`}
              aria-current={s.id === seg.id ? "page" : undefined}
              className={cn(
                "flex items-center justify-between gap-2 border-b border-line-2 px-3 py-2.5 text-[13px] font-semibold last:border-b-0",
                s.id === seg.id ? "bg-seg-sel text-fg shadow-[inset_3px_0_0_var(--color-accent)]" : "text-fg-2 hover:bg-row-b hover:text-fg",
              )}
            >
              {s.shortName}
              <span className={cn("size-2 shrink-0 rounded-full", verdictDot(s.verdict))} aria-hidden />
            </Link>
          ))}
        </nav>
        <SegmentSelect segments={segments.map((s) => ({ id: s.id, name: s.shortName }))} current={seg.id} />

        <div className="min-w-0 flex-1">
          <Panel className="mb-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-[17px] font-bold text-fg">{seg.shortName}</h2>
              <VerdictTag verdict={seg.verdict} />
            </div>
            {seg.conclusionVi && <p className="mt-2 max-w-[110ch] text-[13px] leading-relaxed text-fg-2">{seg.conclusionVi}</p>}
            <p className="mt-2 text-[11.5px] text-faint">{seg.nameVi}</p>
          </Panel>

          <RivalsTable items={items} />

          {/* Collapsed by default: the table is the main view, the review quotes are opened on demand */}
          <details className="group mt-6">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-panel border border-line bg-panel px-4 py-3 hover:border-accent [&::-webkit-details-marker]:hidden">
              <span className="flex items-baseline gap-2">
                <span className="text-[15px] font-bold text-fg">{t.reviews}</span>
                <span className="text-[12px] text-muted">{t.reviewCount(benchmarks.length)}</span>
              </span>
              <span className="flex items-center gap-1 text-[12.5px] font-semibold text-key">
                <span className="group-open:hidden">{t.showReviews}</span>
                <span className="hidden group-open:inline">{t.hideReviews}</span>
                <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <div className="mt-3">
              <BenchmarkCards cards={benchmarks} emptyText={t.noReviews} />
            </div>
          </details>
        </div>
      </div>
    </>
  );
}
