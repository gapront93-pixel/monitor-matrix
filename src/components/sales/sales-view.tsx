"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ProductImage } from "@/components/product-image";
import { Chip } from "@/components/ui/chip";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { fmtNum, fmtPct, fmtVndCompact } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { salesMessages } from "@/lib/i18n/messages/sales";
import type { SalesItem, SalesReport } from "@/lib/sales";
import { DEFAULT_RANGE, RANGE_PRESETS, type RangePreset } from "@/lib/sales-period";
import { cn } from "@/lib/utils";

type Props = {
  report: SalesReport;
  filter: { preset: RangePreset; from: string; to: string; npp: string | null };
  range: { first: string; last: string; npps: string[] };
  segments: { id: string; name: string }[];
};

const label = (m: string) => `${m.slice(5)}/${m.slice(0, 4)}`;
const pct = (v: number, total: number) => (total ? `${((v / total) * 100).toFixed(1)}%` : "—");

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

const axisTick = { fill: "var(--color-faint)", fontSize: 10.5, fontFamily: "var(--font-mono)" };

export function SalesView({ report, filter, range, segments }: Props) {
  const t = useT(salesMessages);
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [sort, setSort] = useState<"qty" | "amount">("amount");
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());

  // Same URL shape as the dashboard: range only when not the default, months only for a custom range
  const go = (next: Partial<Props["filter"]>) => {
    const f = { ...filter, ...next };
    const p = new URLSearchParams();
    if (f.preset !== DEFAULT_RANGE) p.set("range", f.preset);
    if (f.preset === "custom") {
      p.set("tu", f.from);
      p.set("den", f.to);
    }
    if (f.npp) p.set("npp", f.npp);
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
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
  const bySize = group((m) => (m.sizeIn ? `${Math.round(m.sizeIn)}"` : t.unknown));
  const byPanel = group((m) => m.panel ?? t.unknown);
  const toggle = (key: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (!n.delete(key)) n.add(key);
      return n;
    });

  const selectCls = "h-8 rounded-ctl border border-line bg-app px-2 text-[13px] text-fg";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={t.period}
          className={cn(selectCls, "font-semibold")}
          value={filter.preset}
          onChange={(e) => {
            const preset = e.target.value as RangePreset;
            // Custom starts from the period on screen, then each end can be changed
            go(preset === "custom" ? { preset, from: filter.from, to: filter.to } : { preset });
          }}
        >
          {RANGE_PRESETS.map((p) => (
            <option key={p} value={p}>
              {t.ranges[p]}
            </option>
          ))}
        </select>
        {filter.preset === "custom" ? (
          <>
            <label className="flex items-center gap-1.5 text-[12.5px] text-muted">
              {t.from}
              <select className={cn(selectCls, "num")} value={filter.from} onChange={(e) => go({ preset: "custom", from: e.target.value })}>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {label(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-[12.5px] text-muted">
              {t.to}
              <select className={cn(selectCls, "num")} value={filter.to} onChange={(e) => go({ preset: "custom", to: e.target.value })}>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {label(m)}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <span className="num text-[12.5px] text-muted">
            {filter.from === filter.to ? label(filter.from) : `${label(filter.from)} – ${label(filter.to)}`}
          </span>
        )}
        <select aria-label={t.npp} className={cn(selectCls, "ml-auto")} value={filter.npp ?? ""} onChange={(e) => go({ npp: e.target.value || null })}>
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

          {/* Revenue as bars on the left axis, units as a line on the right axis */}
          <Panel className="p-4">
            <h2 className="mb-2 text-[14px] font-bold text-fg">{t.chart.title}</h2>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 900, height: 260 }}>
                <ComposedChart data={report.months} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--color-line-2)" />
                  <XAxis dataKey="month" tickFormatter={label} tickLine={false} axisLine={false} tick={axisTick} />
                  <YAxis yAxisId="amount" width={60} tickLine={false} axisLine={false} tickFormatter={(v: number) => money(v)} tick={axisTick} />
                  <YAxis yAxisId="qty" orientation="right" width={52} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtNum(v)} tick={axisTick} />
                  <Tooltip
                    cursor={{ fill: "var(--color-accent-tint)" }}
                    contentStyle={{ background: "var(--color-panel)", border: "1px solid var(--color-line)", borderRadius: 5, fontSize: 12 }}
                    labelStyle={{ color: "var(--color-fg)", fontWeight: 600 }}
                    itemStyle={{ color: "var(--color-fg-2)", fontFamily: "var(--font-mono)" }}
                    labelFormatter={(m) => label(String(m))}
                    formatter={(v, name) => [name === t.chart.amount ? `${fmtNum(Number(v))} VNĐ` : fmtNum(Number(v)), name]}
                  />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12, color: "var(--color-fg-2)" }} />
                  <Bar yAxisId="amount" dataKey="amount" name={t.chart.amount} fill="var(--color-accent)" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
                  <Line
                    yAxisId="qty"
                    dataKey="qty"
                    name={t.chart.qty}
                    type="monotone"
                    stroke="var(--color-aorus)"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: "var(--color-aorus)", strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <div className="grid items-start gap-3 xl:grid-cols-2">
            <ShareTable title={t.share.npp} nameHead={t.share.nppCol} rows={report.npps} totals={totals} money={money} />
            <ShareTable
              title={t.share.segment}
              nameHead={t.share.segmentCol}
              rows={report.segments.map((s) => (s.label === "?" ? { ...s, label: t.unknown } : s))}
              totals={totals}
              money={money}
              withModels
            />
          </div>

          <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <h2 className="text-[14px] font-bold text-fg">{t.models.title}</h2>
              <div className="flex gap-1.5">
                <Chip active={sort === "amount"} onClick={() => setSort("amount")}>
                  {t.models.sortAmount}
                </Chip>
                <Chip active={sort === "qty"} onClick={() => setSort("qty")}>
                  {t.models.sortQty}
                </Chip>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-separate border-spacing-0 text-[12.5px] whitespace-nowrap">
                <thead>
                  <tr className="text-[11.5px] text-muted">
                    {[t.models.rank, t.models.model, t.models.segment, t.share.qty, t.share.qtyShare, t.share.amount, t.share.amountShare, t.models.asp, t.models.retail, t.models.gap].map((h, i) => (
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
                    const sub = "border-b border-line-2 bg-head px-3 py-1.5";
                    const isOpen = open.has(m.key);
                    return (
                      <Fragment key={m.key}>
                        <tr>
                          <td className={cn(td, "num w-10 text-faint")}>{i + 1}</td>
                          <td className={td}>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggle(m.key)}
                                aria-expanded={isOpen}
                                aria-label={t.models.open(m.label)}
                                className="grid size-6 shrink-0 place-items-center rounded-ctl text-muted hover:bg-accent-tint hover:text-fg"
                              >
                                <ChevronRight aria-hidden className={cn("size-4 transition-transform", isOpen && "rotate-90")} />
                              </button>
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
                          <td className={cn(td, "num text-right text-muted")}>{pct(m.qty, totals.qty)}</td>
                          <td className={cn(td, "num text-right font-semibold text-fg")}>{money(m.amount)}</td>
                          <td className={cn(td, "num text-right text-muted")}>{pct(m.amount, totals.amount)}</td>
                          <td className={cn(td, "num text-right text-fg-2")}>{asp ? fmtNum(asp) : "—"}</td>
                          <td className={cn(td, "num text-right", m.minPrice ? "text-best" : "text-faint")}>{m.minPrice ? fmtNum(m.minPrice) : "—"}</td>
                          <td className={cn(td, "num text-right", gap === null ? "text-faint" : gap < 0 ? "text-up" : "text-fg-2")}>{gap === null ? "—" : fmtPct(gap)}</td>
                        </tr>
                        {/* The original codes behind the SO Model, per NPP (shares are within this SO Model) */}
                        {isOpen &&
                          m.sources.map((s) => (
                            <tr key={`${s.model}|${s.npp}`} className="text-[12px]">
                              <td className="border-b border-line-2 bg-head" />
                              <td className="border-b border-line-2 bg-head py-1.5 pr-3 pl-[86px] font-mono text-fg-2">{s.model}</td>
                              <td className={cn(sub, "text-muted")}>{s.npp}</td>
                              <td className={cn(sub, "num text-right text-fg-2")}>{fmtNum(s.qty)}</td>
                              <td className={cn(sub, "num text-right text-faint")}>{pct(s.qty, m.qty)}</td>
                              <td className={cn(sub, "num text-right text-fg-2")}>{money(s.amount)}</td>
                              <td className={cn(sub, "num text-right text-faint")}>{pct(s.amount, m.amount)}</td>
                              <td className={cn(sub, "num text-right text-fg-2")}>{s.qty > 0 ? fmtNum(Math.round(s.amount / s.qty)) : "—"}</td>
                              <td className="border-b border-line-2 bg-head" colSpan={2} />
                            </tr>
                          ))}
                      </Fragment>
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

          <div className="grid gap-3 md:grid-cols-2">
            <Breakdown title={t.bySize} rows={bySize} total={totals.qty} />
            <Breakdown title={t.byPanel} rows={byPanel} total={totals.qty} />
          </div>

          <Panel className="overflow-hidden">
            <h2 className="border-b border-line px-4 py-3 text-[14px] font-bold text-fg">{t.customers.title}</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-separate border-spacing-0 text-[12.5px]">
                <thead>
                  <tr className="text-[11.5px] text-muted">
                    {[t.models.rank, t.customers.name, t.customers.npp, t.share.qty, t.share.qtyShare, t.share.amount, t.share.amountShare].map((h, i) => (
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
                        <td className={cn(td, "num text-right text-muted")}>{pct(c.qty, totals.qty)}</td>
                        <td className={cn(td, "num text-right text-fg-2")}>{money(c.amount)}</td>
                        <td className={cn(td, "num text-right text-muted")}>{pct(c.amount, totals.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
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

/** Units, revenue and both shares per row, with a revenue-share bar; a total row at the bottom */
function ShareTable({
  title,
  nameHead,
  rows,
  totals,
  money,
  withModels,
}: {
  title: string;
  nameHead: string;
  rows: (SalesItem & { models?: number })[];
  totals: { qty: number; amount: number };
  money: (n: number) => string;
  withModels?: boolean;
}) {
  const t = useT(salesMessages);
  const heads = [nameHead, t.share.qty, t.share.qtyShare, t.share.amount, t.share.amountShare, t.share.asp, ...(withModels ? [t.share.models] : [])];
  const max = Math.max(1, ...rows.map((r) => r.amount));
  const foot = "num bg-head px-3 py-2 text-right";
  return (
    <Panel className="overflow-hidden">
      <h2 className="border-b border-line px-4 py-3 text-[14px] font-bold text-fg">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-0 text-[12.5px] whitespace-nowrap">
          <thead>
            <tr className="text-[11.5px] text-muted">
              {heads.map((h, i) => (
                <th key={h} scope="col" className={cn("border-b border-line bg-head px-3 py-2 font-semibold", i >= 1 ? "text-right" : "text-left")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const td = cn("border-b border-line-2 px-3 py-2", i % 2 === 0 ? "bg-row-a" : "bg-row-b");
              return (
                <tr key={r.key}>
                  <td className={cn(td, "font-semibold text-fg")}>
                    <div className="max-w-[220px] truncate" title={r.label}>
                      {r.label}
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-line-2" aria-hidden>
                      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, (r.amount / max) * 100)}%` }} />
                    </div>
                  </td>
                  <td className={cn(td, "num text-right text-fg")}>{fmtNum(r.qty)}</td>
                  <td className={cn(td, "num text-right text-muted")}>{pct(r.qty, totals.qty)}</td>
                  <td className={cn(td, "num text-right font-semibold text-fg")}>{money(r.amount)}</td>
                  <td className={cn(td, "num text-right font-semibold text-key")}>{pct(r.amount, totals.amount)}</td>
                  <td className={cn(td, "num text-right text-fg-2")}>{r.qty > 0 ? fmtNum(Math.round(r.amount / r.qty)) : "—"}</td>
                  {withModels && <td className={cn(td, "num text-right text-muted")}>{r.models ?? "—"}</td>}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="bg-head px-3 py-2 text-fg">{t.share.total}</td>
              <td className={cn(foot, "text-fg")}>{fmtNum(totals.qty)}</td>
              <td className={cn(foot, "text-muted")}>100%</td>
              <td className={cn(foot, "text-fg")}>{money(totals.amount)}</td>
              <td className={cn(foot, "text-muted")}>100%</td>
              <td className={cn(foot, "text-fg-2")}>{totals.qty > 0 ? fmtNum(Math.round(totals.amount / totals.qty)) : "—"}</td>
              {withModels && <td className="bg-head" />}
            </tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  );
}

/** Horizontal bars, labelled with units and share (one measure, one colour) */
function Breakdown({ title, rows, total }: { title: string; rows: [string, number][]; total: number }) {
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
                {fmtNum(v)} <span className="text-muted">· {pct(v, total)}</span>
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
