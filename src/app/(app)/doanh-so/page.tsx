import type { Metadata } from "next";

import { SalesView } from "@/components/sales/sales-view";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/panel";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { requireUser } from "@/lib/auth";
import { getCatalog } from "@/lib/catalog";
import { fmtDate, isoDay } from "@/lib/format";
import { salesMessages } from "@/lib/i18n/messages/sales";
import { getLocale, getT } from "@/lib/i18n/server";
import { can } from "@/lib/permissions";
import { salesConfigured, salesRange, salesReport } from "@/lib/sales";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT(salesMessages)).title };
}

const MONTH = /^\d{4}-\d{2}$/;

function shift(m: string, by: number): string {
  const [y, mo] = m.split("-").map(Number);
  const t = y * 12 + (mo - 1) + by;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ tu?: string; den?: string; npp?: string }> }) {
  const [me, t, locale, sp] = await Promise.all([requireUser(), getT(salesMessages), getLocale(), searchParams]);
  if (!can(me.role, "sales")) {
    return (
      <EmptyState
        title={t.noAccess}
        action={
          <ButtonLink href="/" variant="primary" size="sm">
            {locale === "vi" ? "Về Tổng quan" : "Back to Overview"}
          </ButtonLink>
        }
      >
        {t.noAccessText}
      </EmptyState>
    );
  }
  if (!salesConfigured()) return <ErrorState title={t.notConfigured}>{t.notConfiguredText}</ErrorState>;

  const range = await salesRange();
  if (!range.first || !range.last) return <EmptyState title={t.noData}>{t.noDataText}</EmptyState>;

  // Presets are calendar periods of today (Vietnam time); months without rows simply count as zero
  const now = isoDay(new Date()).slice(0, 7);
  const q = Math.floor((Number(now.slice(5)) - 1) / 3);
  const presets = {
    month: { from: now, to: now },
    quarter: { from: `${now.slice(0, 4)}-${String(q * 3 + 1).padStart(2, "0")}`, to: now },
    year: { from: `${now.slice(0, 4)}-01`, to: now },
    last12: { from: shift(now, -11), to: now },
    all: { from: range.first, to: range.last },
  };
  let from = sp.tu && MONTH.test(sp.tu) ? sp.tu : presets.last12.from;
  let to = sp.den && MONTH.test(sp.den) ? sp.den : presets.last12.to;
  if (from > to) [from, to] = [to, from];
  const npp = sp.npp && range.npps.includes(sp.npp) ? sp.npp : null;

  const catalog = await getCatalog();
  const report = await salesReport({ from, to, npp }, catalog);

  return (
    <>
      <PageHeader eyebrow={t.eyebrow} title={t.title} sub={t.sub(range.lastDay ? fmtDate(range.lastDay) : range.last)} />
      <SalesView
        report={report}
        filter={{ from, to, npp }}
        range={{ first: range.first, last: range.last, npps: range.npps }}
        presets={presets}
        segments={catalog.segments.map((s) => ({ id: s.id, name: s.shortName }))}
      />
    </>
  );
}
