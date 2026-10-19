import type { Metadata } from "next";

import { PriceGrid } from "@/components/prices/price-grid";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { getCatalog } from "@/lib/catalog";
import { fmtDate, isoDay } from "@/lib/format";
import { gridDealers, gridRows } from "@/lib/price-table";

export const metadata: Metadata = { title: "Bảng giá" };

const noon = (day: string) => new Date(`${day}T12:00:00+07:00`);

export default async function PricesPage({ searchParams }: { searchParams: Promise<{ ngay?: string }> }) {
  const { ngay } = await searchParams;
  const all = await getCatalog();
  // Days that have a price import, newest first
  const days = [...new Set(all.imports.map((i) => isoDay(i.capturedAt)))];
  const latest = days[0];

  if (!latest) {
    return (
      <>
        <PageHeader eyebrow="Bảng giá" title="Giá bán lẻ theo đại lý" />
        <EmptyState
          title="Bảng giá chưa có dữ liệu"
          action={
            <ButtonLink href="/admin" variant="primary" size="sm">
              Tải file giá
            </ButtonLink>
          }
        >
          Chưa có lần nhập giá nào. Tải file giá của đại lý ở trang Quản trị.
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
