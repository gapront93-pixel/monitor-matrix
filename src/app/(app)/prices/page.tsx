import type { Metadata } from "next";

import { PriceGrid } from "@/components/prices/price-grid";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { getCatalog } from "@/lib/catalog";
import { fmtDate, isoDay } from "@/lib/format";
import { productsMessages } from "@/lib/i18n/messages/products";
import { getT } from "@/lib/i18n/server";
import { gridDealers, gridRows } from "@/lib/price-table";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT(productsMessages)).prices.title };
}

const noon = (day: string) => new Date(`${day}T12:00:00+07:00`);

export default async function PricesPage({ searchParams }: { searchParams: Promise<{ ngay?: string }> }) {
  const { ngay } = await searchParams;
  const [all, msgs] = await Promise.all([getCatalog(), getT(productsMessages)]);
  const t = msgs.prices;
  // Days that have a price import, newest first
  const days = [...new Set(all.imports.map((i) => isoDay(i.capturedAt)))];
  const latest = days[0];

  if (!latest) {
    return (
      <>
        <PageHeader eyebrow={t.title} title={t.heading} />
        <EmptyState
          title={t.empty}
          action={
            <ButtonLink href="/admin" variant="primary" size="sm">
              {t.upload}
            </ButtonLink>
          }
        >
          {t.emptyText}
        </EmptyState>
      </>
    );
  }

  const day = ngay && days.includes(ngay) && ngay !== latest ? ngay : undefined;
  const catalog = day ? await getCatalog(day) : all;

  return (
    <PriceGrid
      rows={gridRows(catalog)}
      dealers={gridDealers(catalog)}
      days={days.map((d) => ({ value: d, label: fmtDate(noon(d)) }))}
      day={day ?? latest}
      isHistory={!!day}
      dayLabel={fmtDate(noon(day ?? latest))}
    />
  );
}
