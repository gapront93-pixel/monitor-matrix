import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BenchmarkCards } from "@/components/benchmark-cards";
import { CompareTable } from "@/components/compare/compare-table";
import { ProductImage } from "@/components/product-image";
import { AddToCompare, DetailTabs, type TabId } from "@/components/products/detail-tabs";
import { PriceHistoryChart } from "@/components/products/price-history-chart";
import { ButtonA, ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { comparable, getCatalog, type Catalog, type ProductView } from "@/lib/catalog";
import { byRivalBrand, fmtDate, fmtDiff, fmtNum, fmtPriceCell, resLabel } from "@/lib/format";
import { isBuyable } from "@/lib/import/prices";
import { fobDay, importStats } from "@/lib/import-stats";
import { prisma } from "@/lib/prisma";
import { priceHistory, productBenchmarks } from "@/lib/product-detail";
import { catalogMessages } from "@/lib/i18n/messages/catalog";
import { productsMessages } from "@/lib/i18n/messages/products";
import { getLocale, getT } from "@/lib/i18n/server";
import { countsAsOffer, priceLink } from "@/lib/pricing";
import { groupSpecs } from "@/lib/specs";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const p = (await getCatalog()).bySlug.get(decodeURIComponent(slug));
  return { title: p ? `${p.brand === "GIGABYTE" ? "" : p.brand + " "}${p.model}` : (await getT(productsMessages)).detail.notFound };
}

export default async function ProductPage({ params, searchParams }: Params) {
  const [{ slug }, { tab }, msgs, locale] = await Promise.all([params, searchParams, getT(productsMessages), getLocale()]);
  const t = msgs.detail;
  const catalog = await getCatalog();
  const p = catalog.bySlug.get(decodeURIComponent(slug));
  if (!p) notFound();

  const [raw, history, benchmarks] = await Promise.all([
    prisma.product.findUnique({ where: { id: p.id }, select: { rawSpecs: true } }),
    p.isGigabyte ? priceHistory(p, catalog.dealers) : Promise.resolve(null),
    productBenchmarks(p),
  ]);
  const segment = catalog.segments.find((s) => s.id === p.segmentId);
  const dealers = new Map(catalog.dealers.map((d) => [d.id, d]));
  const cheapest = p.prices.find((c) => countsAsOffer(c) && c.priceVnd === p.minPrice);
  const cheapestLink = cheapest ? priceLink(cheapest, dealers.get(cheapest.dealerId)?.website ?? null, p.model) : null;
  const specs = groupSpecs((raw?.rawSpecs ?? {}) as Record<string, unknown>, p.isGigabyte, locale);

  // Same segment, other side: rivals for a GIGABYTE model, GIGABYTE models for a rival.
  // Rivals only count when the customs data shows them imported in the last 9 months (the 3 most imported),
  // except Samsung: it imports outside these customs records, so its model is always added after them
  const sameSegment = catalog.products.filter((o) => o.segmentId && o.segmentId === p.segmentId && o.isGigabyte !== p.isGigabyte);
  const imports = await importStats([p, ...sameSegment]);
  const exempt = (o: (typeof sameSegment)[number]) => o.brand === "Samsung";
  const others = p.isGigabyte
    ? [
        ...sameSegment
          .filter((o) => !exempt(o) && (imports.get(o.slug)?.qty ?? 0) > 0)
          .sort((a, b) => (imports.get(b.slug)?.qty ?? 0) - (imports.get(a.slug)?.qty ?? 0) || byRivalBrand(a, b))
          .slice(0, 3),
        ...sameSegment.filter(exempt).slice(0, 1),
      ]
    : [...sameSegment].sort(byRivalBrand).slice(0, 3);
  const withFob = (o: (typeof catalog.products)[number]) => ({ ...comparable(o), fobUsd: imports.get(o.slug)?.fob ?? null, fobDate: fobDay(imports.get(o.slug)?.fobDate ?? null) });

  const chips = [p.sizeIn !== null && `${p.sizeIn}"`, p.panel, resLabel(p.resolution), p.refreshHz && `${p.refreshHz}Hz`, p.responseMs !== null && `${p.responseMs}ms`].filter(Boolean) as string[];

  return (
    <>
      <nav aria-label={t.breadcrumb} className="mb-3 text-[12.5px] text-muted">
        <Link href="/san-pham" className="hover:text-fg">
          {msgs.matrix.title}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-fg">{p.model}</span>
      </nav>

      <Panel className="mb-5 flex flex-col gap-5 p-4 md:flex-row md:p-5">
        <ProductImage src={p.image} label={p.model} sizes="(min-width: 1280px) 380px, (min-width: 760px) 260px, 100vw" className="aspect-[16/10] w-full shrink-0 md:max-w-[260px] xl:max-w-[380px]" />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="eyebrow">
            <span className={p.isGigabyte ? "text-brand-gb" : undefined}>{p.brand}</span>
            {p.series === "AORUS" && <span className="text-aorus"> · AORUS</span>}
            {p.line && t.lineOf(p.line)}
          </div>
          <h1 className="mt-1 text-[22px] leading-tight font-bold text-fg md:text-[28px]">{p.model}</h1>
          <div className="mt-1 flex flex-wrap gap-x-3 text-[12.5px] text-muted">
            {segment && (
              <Link href={`/doi-thu?pk=${segment.id}`} className="hover:text-fg">
                {segment.shortName}
              </Link>
            )}
            {p.url && (
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-key hover:underline">
                {t.makerSpecs}
              </a>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span key={c} className="num rounded-chip border border-line bg-app px-2 py-1 text-[11.5px] text-fg">
                {c}
              </span>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 md:mt-auto md:flex-row md:items-end md:justify-between">
            <div>
              {p.isGigabyte ? (
                <>
                  <div className="text-[12.5px] text-muted">{t.lowestToday}</div>
                  {p.minPrice ? (
                    <>
                      <div className="num text-[28px] leading-tight font-semibold text-best">{fmtNum(p.minPrice)}</div>
                      <div className="text-[12.5px] text-fg-2">
                        {t.at(p.minDealerIds.map((id) => dealers.get(id)?.name).join(", "), p.inStock)}
                        {catalog.asOf && t.updated(fmtDate(catalog.asOf))}
                      </div>
                    </>
                  ) : (
                    <div className="mt-1 text-[14px] text-faint">{t.noRetail}</div>
                  )}
                </>
              ) : (
                <div className="text-[12.5px] text-muted">
                  {t.rivalNoPrice}
                  {p.prices.length === 0 && segment && t.rivalHint}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <AddToCompare slug={p.slug} />
              {cheapestLink && (
                <ButtonA href={cheapestLink} variant="primary">
                  {t.openDealer}
                </ButtonA>
              )}
            </div>
          </div>
        </div>
      </Panel>

      <DetailTabs
        label={t.tabsLabel}
        initial={(tab as TabId) ?? "thong-so"}
        tabs={[
          { id: "thong-so", label: t.tabSpecs, content: <SpecPanels groups={specs} t={msgs} /> },
          ...(p.isGigabyte
            ? [{ id: "gia" as const, label: t.tabPrices, content: <PriceTab p={p} catalog={catalog} history={history!} t={msgs} stock={(await getT(catalogMessages)).stock} /> }]
            : []),
          {
            id: "doi-thu",
            label: p.isGigabyte ? t.tabRivals : t.tabGigabyte,
            content: others.length ? (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12.5px] text-muted">
                    {t.bestNote(segment?.shortName ?? "")}
                  </p>
                  <ButtonLink href={`/so-sanh?m=${[p, ...others].map((o) => encodeURIComponent(o.slug)).join(",")}`} size="sm">
                    {t.openCompare}
                  </ButtonLink>
                </div>
                <CompareTable items={[p, ...others].map(withFob)} showImages={false} />
              </>
            ) : (
              <EmptyState
                title={sameSegment.length ? t.noImportedRivals : t.noSegment}
                action={
                  <ButtonLink href={`/so-sanh?m=${encodeURIComponent(p.slug)}`} variant="primary" size="sm">
                    {t.pickYourself}
                  </ButtonLink>
                }
              >
                {sameSegment.length ? t.noImportedRivalsText : t.noSegmentText}
              </EmptyState>
            ),
          },
          { id: "benchmark", label: t.tabBench, content: <BenchmarkCards cards={benchmarks} model={p.model} /> },
        ]}
      />
    </>
  );
}

function SpecPanels({ groups, t }: { groups: ReturnType<typeof groupSpecs>; t: (typeof productsMessages)["vi"] }) {
  if (!groups.length) return <EmptyState title={t.detail.noSpecs}>{t.detail.noSpecsText}</EmptyState>;
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,420px),1fr))] items-start gap-3">
      {groups.map((g) => (
        <Panel key={g.id} className="overflow-hidden">
          <h2 className="border-b border-line bg-head px-3.5 py-2.5 text-[12.5px] font-bold tracking-[0.04em] text-fg uppercase">{t.specGroups[g.id]}</h2>
          <table className="w-full text-[12.5px]">
            <tbody>
              {g.rows.map((r, i) => (
                <tr key={r.label + i} className={i % 2 === 0 ? "bg-row-b" : "bg-panel"}>
                  <th scope="row" className="w-[44%] px-3.5 py-2 text-left align-top font-normal text-muted">
                    {r.label}
                  </th>
                  <td className="num px-3.5 py-2 text-right text-[12px] break-words whitespace-pre-line text-fg">{r.value.replace(/;\s*/g, "\n")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ))}
    </div>
  );
}

function PriceTab({
  p,
  catalog,
  history,
  t: msgs,
  stock,
}: {
  p: ProductView;
  catalog: Catalog;
  history: Awaited<ReturnType<typeof priceHistory>>;
  t: (typeof productsMessages)["vi"];
  stock: (typeof catalogMessages)["vi"]["stock"];
}) {
  const t = msgs.detail;
  const dealers = new Map(catalog.dealers.map((d) => [d.id, d]));
  const cells = p.prices
    .filter((c) => dealers.get(c.dealerId)?.visible)
    // Buyable retail offers by price, then wholesale, then contact / out of stock
    .sort((a, b) => rank(a) - rank(b) || (a.priceVnd ?? Infinity) - (b.priceVnd ?? Infinity));

  function rank(c: (typeof cells)[number]): number {
    if (countsAsOffer(c)) return 0;
    if (c.priceType === "dealer" && c.priceVnd !== null && isBuyable(c.stockStatus)) return 1;
    return isBuyable(c.stockStatus) ? 2 : 3;
  }
  if (!cells.length) {
    return (
      <EmptyState title={t.noDealers}>
        {t.noDealersText}
      </EmptyState>
    );
  }
  return (
    <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="overflow-x-auto rounded-panel border border-line">
        <table className="w-full border-separate border-spacing-0 text-[12.5px]">
          <thead>
            <tr className="text-[11.5px] text-muted">
              <th scope="col" className="border-b border-line bg-head px-3 py-2 text-left font-semibold">{t.col.dealer}</th>
              <th scope="col" className="border-b border-line bg-head px-3 py-2 text-left font-semibold">{t.col.status}</th>
              <th scope="col" className="border-b border-line bg-head px-3 py-2 text-right font-semibold">{t.col.price}</th>
              <th scope="col" className="hidden border-b border-line bg-head px-3 py-2 text-right font-semibold md:table-cell">{t.col.vsLowest}</th>
            </tr>
          </thead>
          <tbody>
            {cells.map((c, i) => {
              const d = dealers.get(c.dealerId)!;
              const link = priceLink(c, d.website, p.model);
              const gone = !isBuyable(c.stockStatus);
              const wholesale = d.priceType === "dealer";
              const best = countsAsOffer(c) && c.priceVnd === p.minPrice;
              const bg = i % 2 === 0 ? "bg-row-a" : "bg-row-b";
              const td = cn("border-b border-line-2 px-3 py-2", bg);
              return (
                <tr key={c.dealerId}>
                  <td className={td}>
                    <a href={link ?? undefined} target="_blank" rel="noopener noreferrer" className={cn("font-semibold hover:underline", d.isKey ? "text-key" : "text-fg")}>
                      {d.name}
                    </a>
                    {wholesale && <span className="ml-1.5 text-[11px] text-faint italic">{t.wholesale}</span>}
                  </td>
                  <td className={cn(td, gone || c.priceVnd === null ? "text-warn" : "text-fg-2")} title={c.note ?? undefined}>
                    {stock[c.stockStatus]}
                  </td>
                  <td className={cn(td, "num text-right text-[12px] whitespace-nowrap")}>
                    <a href={link ?? undefined} target="_blank" rel="noopener noreferrer" title={c.nameOnSite ?? undefined} className="hover:underline">
                      {c.priceVnd === null ? (
                        <span className={cn("font-sans", gone ? "text-faint-2 line-through" : "text-warn")}>{t.contact}</span>
                      ) : (
                        <span className={cn(gone ? "text-faint-2 line-through" : wholesale ? "text-wholesale italic" : best ? "font-semibold text-best" : "text-fg")}>
                          {fmtPriceCell(c.priceVnd)}
                        </span>
                      )}
                    </a>
                  </td>
                  <td className={cn(td, "num hidden text-right text-[11.5px] text-muted md:table-cell")}>
                    {best ? t.lowest : countsAsOffer(c) && p.minPrice ? fmtDiff(c.priceVnd - p.minPrice) : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PriceHistoryChart points={history.points} series={history.series} />
    </div>
  );
}
