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
import { parsePreset, resolveRange } from "@/lib/sales-period";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT(salesMessages)).title };
}

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ range?: string; tu?: string; den?: string; npp?: string }> }) {
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

  // Calendar periods of today (Vietnam time), as on the vnpromotion dashboard; months without rows count as zero
  const preset = parsePreset(sp.range);
  const { from, to } = resolveRange(preset, isoDay(new Date()).slice(0, 7), sp.tu, sp.den);
  const npp = sp.npp && range.npps.includes(sp.npp) ? sp.npp : null;

  const catalog = await getCatalog();
  const report = await salesReport({ from, to, npp }, catalog);

  return (
    <>
      <PageHeader eyebrow={t.eyebrow} title={t.title} sub={t.sub(range.lastDay ? fmtDate(range.lastDay) : range.last)} />
      <SalesView
        report={report}
        filter={{ preset, from, to, npp }}
        range={{ first: range.first, last: range.last, npps: range.npps }}
        segments={catalog.segments.map((s) => ({ id: s.id, name: s.shortName }))}
      />
    </>
  );
}
