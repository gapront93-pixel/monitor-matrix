import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { PageHeader, Panel, VerdictTag } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { getCatalog } from "@/lib/catalog";
import { byRivalBrand, fmtDate, fmtDayMonth, modelCode } from "@/lib/format";
import { catalogMessages } from "@/lib/i18n/messages/catalog";
import { getT } from "@/lib/i18n/server";

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Panel className="px-[18px] py-4">
      <div className="text-[12.5px] text-fg-2">{label}</div>
      <div className="num mt-1.5 text-[30px] leading-tight font-semibold tracking-[-0.02em] text-fg">{value}</div>
      <div className="mt-1 text-[12px] text-muted">{sub}</div>
    </Panel>
  );
}

export default async function OverviewPage() {
  const [{ products, dealers, segments, asOf, imports }, m] = await Promise.all([getCatalog(), getT(catalogMessages)]);
  const t = m.overview;
  const gigabyte = products.filter((p) => p.isGigabyte);
  const priced = gigabyte.filter((p) => p.prices.some((c) => c.priceVnd !== null));
  const tracked = dealers.filter((d) => d.visible);
  const latest = imports[0];

  return (
    <>
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        actions={
          <>
            <ButtonLink href="/bang-gia" variant="primary">
              {t.openPrices}
            </ButtonLink>
            <ButtonLink href="/san-pham">{t.seeProducts}</ButtonLink>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        <Kpi label={t.kpiModels} value={String(gigabyte.length)} sub={t.kpiModelsSub} />
        <Kpi label={t.kpiPriced} value={String(priced.length)} sub={t.kpiPricedSub} />
        <Kpi label={t.kpiDealers} value={String(tracked.length)} sub={t.kpiDealersSub(tracked.filter((d) => d.isKey).length)} />
        <Kpi
          label={t.kpiUpdated}
          value={asOf ? fmtDayMonth(asOf) : "—"}
          sub={asOf ? `${fmtDate(asOf)} · ${latest?.source === "admin" ? t.fromAdmin : t.fromSeed}` : t.noImport}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[18px] font-bold text-fg">{t.segments}</h2>
        <span className="text-[12px] text-muted">{t.segmentsNote}</span>
      </div>

      {segments.length === 0 ? (
        <EmptyState title={t.noSegments}>{t.noSegmentsText}</EmptyState>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
          {segments.map((s) => {
            const mine = products.filter((p) => p.segmentId === s.id && p.isGigabyte);
            const rivals = products.filter((p) => p.segmentId === s.id && !p.isGigabyte).sort(byRivalBrand);
            const rivalText = rivals
              .slice(0, 3)
              .map((r) => (r.brand === "Dell" ? modelCode(r.model) : `${r.brand} ${modelCode(r.model)}`))
              .join(" · ");
            return (
              <Link
                key={s.id}
                href={`/doi-thu?pk=${s.id}`}
                className="group flex flex-col rounded-panel border border-line bg-panel px-4 py-3.5 transition-colors hover:border-line-hover"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[14px] leading-snug font-semibold text-fg">{s.shortName}</h3>
                  <div className="shrink-0 text-right whitespace-nowrap">
                    <span className="num text-[22px] leading-none font-semibold text-fg">{mine.length}</span>
                    <span className="ml-1 text-[11px] text-muted">{m.words.models}</span>
                  </div>
                </div>
                <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
                  {t.mainRivals} <span className="text-fg-2">{rivalText || "—"}</span>
                </p>
                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                  <VerdictTag verdict={s.verdict} />
                  <span className="text-[12px] text-muted group-hover:text-fg">{t.seeRivals}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
