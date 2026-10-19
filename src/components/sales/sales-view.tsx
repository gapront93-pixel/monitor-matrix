"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ProductImage } from "@/components/product-image";
import { Chip } from "@/components/ui/chip";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { fmtNum, fmtPct, fmtVndCompact } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { salesMessages } from "@/lib/i18n/messages/sales";
import type { SalesReport } from "@/lib/sales";
import { cn } from "@/lib/utils";

type Period = { from: string; to: string };
type Props = {
  report: SalesReport;
  filter: Period & { npp: string | null };
  range: { first: string; last: string; npps: string[] };
  presets: Record<"month" | "quarter" | "year" | "last12" | "all", Period>;
  segments: { id: string; name: string }[];
};

const label = (m: string) => `${m.slice(5)}/${m.slice(0, 4)}`;

function monthsOf(first: string, last: string): string[] {
  const out: string[] = [];
  let [y, m] = first.split("-").map(Number);
  const [ly, lm] = last.split("-").map(Number);
  while (y < ly || (y === ly && m <= lm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (m === 12) {
      m = 1;
      y++;
    } else m++;
  }
  return out;
}

export function SalesView({ report, filter, range, presets, segments }: Props) {
  const t = useT(salesMessages);
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [metric, setMetric] = useState<"qty" | "amount">("qty");
  const [sort, setSort] = useState<"qty" | "amount">("qty");
  const [all, setAll] = useState(false);

  const go = (next: Partial<Props["filter"]>) => {
    const f = { ...filter, ...next };
    const p = new URLSearchParams({ tu: f.from, den: f.to });
    if (f.npp) p.set("npp", f.npp);
    router.push(`${pathname}?${p}`);
  };
  const money = (n: number) => fmtVndCompact(n, locale);
  const months = useMemo(() => monthsOf(range.first, range.last), [range]);
  const { totals, previous } = report;
  const span = report.months.length;
  const delta = (cur: number, prev: number | undefined) => (prev ? ((cur - prev) / Math.abs(prev)) * 100 : null);

  const models = useMemo(() => [...report.models].sort((a, b) => (sort === "qty" ? b.qty - a.qty : b.amount - a.amount)), [report.models, sort]);
  const segName = new Map(segments.map((s) => [s.id, s.name]));
  const group = (key: (m: SalesReport["models"][number]) => string) => {
    const g = new Map<string, number>();
    for (const m of report.models) g.set(key(m), (g.get(key(m)) ?? 0) + m.qty);
    return [...g.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  };
  const bySegment = group((m) => (m.segmentId ? (segName.get(m.segmentId) ?? m.segmentId) : m.productSlug ? t.otherSegment : t.unknown));
  const bySize = group((m) => (m.sizeIn ? `${Math.round(m.sizeIn)}"` : t.unknown));
  const byPanel = group((m) => m.panel ?? t.unknown);

  const presetActive = (k: keyof Props["presets"]) => presets[k].from === filter.from && presets[k].to === filter.to;
  const selectCls = "h-8 rounded-ctl border border-line bg-app px-2 text-[13px] text-fg";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(presets) as (keyof Props["presets"])[]).map((k) => (
          <Chip key={k} active={presetActive(k)} onClick={() => go(presets[k])}>
            {t.presets[k]}
          </Chip>
        ))}
        <label className="ml-1 flex items-center gap-1.5 text-[12.5px] text-muted">
          {t.from}
          <select className={cn(selectCls, "num")} value={filter.from} onChange={(e) => go({ from: e.target.value })}>
            {months.map((m) => (
              <option key={m} value={m}>
                {label(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[12.5px] text-muted">
          {t.to}
          <select className={cn(selectCls, "num")} value={filter.to} onChange={(e) => go({ to: e.target.value })}>
            {months.map((m) => (
              <option key={m} value={m}>
                {label(m)}
              </option>
            ))}
          </select>
        </label>
        <select aria-label={t.npp} className={selectCls} value={filter.npp ?? ""} onChange={(e) => go({ npp: e.target.value || null })}>
          <option value="">{t.allNpp}</option>
          {range.npps.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      {totals.qty === 0 && totals.amount === 0 ? (
        <EmptyState title={t.noData}>{t.noDataText}</EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
            <Kpi label={t.kpi.qty} value={fmtNum(totals.qty)} unit={t.kpi.qtyUnit} delta={delta(totals.qty, previous?.qty)} note={previous ? t.kpi.vsPrev(span) : t.kpi.noPrev} />
            <Kpi label={t.kpi.amount} value={money(totals.amount)} delta={delta(totals.amount, previous?.amount)} note={previous ? t.kpi.vsPrev(span) : t.kpi.noPrev} />
            <Kpi label={t.kpi.asp} value={totals.qty > 0 ? fmtNum(Math.round(totals.amount / totals.qty)) : "—"} note="VNĐ" />
            <Kpi label={t.kpi.models} value={fmtNum(totals.models)} />
            <Kpi label={t.kpi.customers} value={fmtNum(totals.customers)} />
          </div>

          <Panel className="p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[14px] font-bold text-fg">{t.chart.title}</h2>
              <div className="flex gap-1.5">
                <Chip active={metric === "qty"} onClick={() => setMetric("qty")}>
                  {t.chart.qty}
                </Chip>
                <Chip active={metric === "amount"} onClick={() => setMetric("amount")}>
                  {t.chart.amount}
                </Chip>
              </div>
            </div>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 900, height: 240 }}>
                <BarChart data={report.months} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--color-line-2)" />
                  <XAxis dataKey="month" tickFormatter={label} tickLine={false} axisLine={false} tick={{ fill: "var(--color-faint)", fontSize: 10.5, fontFamily: "var(--font-mono)" }} />
                  <YAxis
                    width={64}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => (metric === "qty" ? fmtNum(v) : money(v))}
                    tick={{ fill: "var(--color-faint)", fontSize: 10.5, fontFamily: "var(--font-mono)" }}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-accent-tint)" }}
                    contentStyle={{ background: "var(--color-panel)", border: "1px solid var(--color-line)", borderRadius: 5, fontSize: 12 }}
                    labelStyle={{ color: "var(--color-fg)", fontWeight: 600 }}
                    itemStyle={{ color: "var(--color-fg-2)", fontFamily: "var(--font-mono)" }}
                    labelFormatter={(m) => label(String(m))}
                    formatter={(v) => [metric === "qty" ? fmtNum(Number(v)) : `${fmtNum(Number(v))} VNĐ`, metric === "qty" ? t.chart.qty : t.chart.amount]}
                  />
                  <Bar dataKey={metric} fill="var(--color-accent)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <h2 className="text-[14px] font-bold text-fg">{t.models.title}</h2>
              <div className="flex gap-1.5">
                <Chip active={sort === "qty"} onClick={() => setSort("qty")}>
                  {t.models.sortQty}
                </Chip>
                <Chip active={sort === "amount"} onClick={() => setSort("amount")}>
                  {t.models.sortAmount}
                </Chip>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-separate border-spacing-0 text-[12.5px]">
                <thead>
                  <tr className="text-[11.5px] text-muted">
                    {[t.models.rank, t.models.model, t.models.segment, t.models.qty, t.models.amount, t.models.share, t.models.asp, t.models.retail, t.models.gap].map((h, i) => (
                      <th key={h} scope="col" className={cn("border-b border-line bg-head px-3 py-2 font-semibold", i >= 3 ? "text-right" : "text-left")}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(all ? models : models.slice(0, 15)).map((m, i) => {
                    const asp = m.qty > 0 ? Math.round(m.amount / m.qty) : null;
                    const gap = asp && m.minPrice ? ((m.minPrice - asp) / asp) * 100 : null;
                    const td = cn("border-b border-line-2 px-3 py-2", i % 2 === 0 ? "bg-row-a" : "bg-row-b");
                    return (
                      <tr key={m.key}>
                        <td className={cn(td, "num w-10 text-faint")}>{i + 1}</td>
                        <td className={td}>
                          <div className="flex items-center gap-2.5">
                            <ProductImage src={m.thumb} className="h-7 w-10 shrink-0" sizes="40px" />
                            {m.productSlug ? (
                              <Link href={`/san-pham/${encodeURIComponent(m.productSlug)}`} prefetch={false} className="font-bold text-fg hover:underline">
                                {m.label}
                              </Link>
                            ) : (
                              <span className="font-semibold text-fg-2">
                                {m.label} <span className="text-[11px] font-normal text-faint">({t.models.notInCatalog})</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={cn(td, "text-[12px] text-muted")}>{m.segmentId ? segName.get(m.segmentId) : "—"}</td>
                        <td className={cn(td, "num text-right font-semibold text-fg")}>{fmtNum(m.qty)}</td>
                        <td className={cn(td, "num text-right text-fg-2")}>{money(m.amount)}</td>
                        <td className={cn(td, "num text-right text-muted")}>{totals.qty ? `${((m.qty / totals.qty) * 100).toFixed(1)}%` : ""}</td>
                        <td className={cn(td, "num text-right text-fg-2")}>{asp ? fmtNum(asp) : "—"}</td>
                        <td className={cn(td, "num text-right", m.minPrice ? "text-best" : "text-faint")}>{m.minPrice ? fmtNum(m.minPrice) : "—"}</td>
                        <td className={cn(td, "num text-right", gap === null ? "text-faint" : gap < 0 ? "text-up" : "text-fg-2")}>{gap === null ? "—" : fmtPct(gap)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[12px] text-muted">
              <span>
                {report.unmatched > 0 && t.models.unmatched(fmtNum(report.unmatched))} {t.models.revNote}
              </span>
              {models.length > 15 && (
                <button type="button" onClick={() => setAll((v) => !v)} className="font-semibold text-key hover:underline">
                  {all ? t.models.showLess : t.models.showAll(models.length)}
                </button>
              )}
            </div>
          </Panel>

          <div className="grid gap-3 xl:grid-cols-3">
            <Breakdown title={t.bySegment} rows={bySegment} total={totals.qty} />
            <Breakdown title={t.bySize} rows={bySize} total={totals.qty} />
            <Breakdown title={t.byPanel} rows={byPanel} total={totals.qty} />
          </div>

          <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel className="overflow-hidden">
              <h2 className="border-b border-line px-4 py-3 text-[14px] font-bold text-fg">{t.customers.title}</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-separate border-spacing-0 text-[12.5px]">
                  <thead>
                    <tr className="text-[11.5px] text-muted">
                      {[t.models.rank, t.customers.name, t.customers.npp, t.customers.qty, t.customers.amount, t.customers.share].map((h, i) => (
                        <th key={h} scope="col" className={cn("border-b border-line bg-head px-3 py-2 font-semibold", i >= 3 ? "text-right" : "text-left")}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.customers.map((c, i) => {
                      const td = cn("border-b border-line-2 px-3 py-2", i % 2 === 0 ? "bg-row-a" : "bg-row-b");
                      return (
                        <tr key={c.key}>
                          <td className={cn(td, "num w-10 text-faint")}>{i + 1}</td>
                          <td className={cn(td, "font-semibold text-fg")}>{c.label}</td>
                          <td className={cn(td, "text-muted")}>{c.npp ?? "—"}</td>
                          <td className={cn(td, "num text-right font-semibold text-fg")}>{fmtNum(c.qty)}</td>
                          <td className={cn(td, "num text-right text-fg-2")}>{money(c.amount)}</td>
                          <td className={cn(td, "num text-right text-muted")}>{totals.qty ? `${((c.qty / totals.qty) * 100).toFixed(1)}%` : ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
            <Breakdown title={t.npps.title} rows={report.npps.map((n) => [n.label, n.qty] as [string, number])} total={totals.qty} extra={(name) => money(report.npps.find((n) => n.label === name)?.amount ?? 0)} />
          </div>
          <p className="text-[12px] text-muted">{t.note}</p>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, unit, delta, note }: { label: string; value: string; unit?: string; delta?: number | null; note?: string }) {
  return (
    <Panel className="px-4 py-3.5">
      <div className="text-[12.5px] text-fg-2">{label}</div>
      <div className="num mt-1 text-[26px] leading-tight font-semibold tracking-[-0.02em] text-fg">
        {value}
        {unit && <span className="ml-1 font-sans text-[12px] font-normal text-muted">{unit}</span>}
      </div>
      {(delta !== undefined || note) && (
        <div className="mt-0.5 text-[11.5px] text-muted">
          {delta !== undefined && delta !== null && <span className={cn("num mr-1 font-semibold", delta >= 0 ? "text-best" : "text-up")}>{fmtPct(delta)}</span>}
          {note}
        </div>
      )}
    </Panel>
  );
}

/** Horizontal bars, labelled with units and share (one measure, one colour) */
function Breakdown({ title, rows, total, extra }: { title: string; rows: [string, number][]; total: number; extra?: (name: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <Panel className="p-4">
      <h2 className="mb-3 text-[14px] font-bold text-fg">{title}</h2>
      <ul className="flex flex-col gap-2">
        {rows.map(([name, v]) => (
          <li key={name}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-[12.5px]">
              <span className="min-w-0 truncate text-fg-2" title={name}>
                {name}
              </span>
              <span className="num shrink-0 text-[12px] text-fg">
                {fmtNum(v)} <span className="text-muted">· {total ? `${((v / total) * 100).toFixed(1)}%` : ""}</span>
                {extra && <span className="text-muted"> · {extra(name)}</span>}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-line-2" aria-hidden>
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, (v / max) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
