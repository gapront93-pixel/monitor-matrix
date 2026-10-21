"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ProductImage } from "@/components/product-image";
import { Chip } from "@/components/ui/chip";
import { ACTIVE_DOT_R, DOT_R, cellFade, dimmed, tooltipFollow, useChartHover } from "@/components/ui/chart-hover";
import { CountUp, Reveal, useTweenRows, useTweens } from "@/components/ui/motion";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { fmtNum, fmtPct, fmtVndCompact } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/client";
import { salesMessages } from "@/lib/i18n/messages/sales";
import type { SalesReport } from "@/lib/sales";
import { DEFAULT_RANGE, RANGE_PRESETS, type RangePreset } from "@/lib/sales-period";
import { cn } from "@/lib/utils";

type Props = {
  report: SalesReport;
  filter: { preset: RangePreset; from: string; to: string; npp: string | null };
  range: { first: string; last: string; npps: string[] };
  segments: { id: string; name: string }[];
};

type ShareRow = { key: string; label: string; qty: number; amount: number };

const label = (m: string) => `${m.slice(5)}/${m.slice(0, 4)}`;
const pct = (v: number, total: number) => (total ? `${((v / total) * 100).toFixed(1)}%` : "—");
const pct1 = (n: number) => `${n.toFixed(1)}%`;
/** Share that counts up with its row */
function Pct({ v, total }: { v: number; total: number }) {
  return total ? <CountUp value={(v / total) * 100} format={pct1} /> : <>—</>;
}

// Donut slices along the cyan -> magenta -> pink steps of the vnpromotion dashboard, largest first; the rest is grey
const SLICE_COLORS = ["#00c2f0", "#4aa8ff", "#7b7cff", "#a855f7", "#d02fe0", "#ff2bc4", "#ff6fb3"];
const OTHER_COLOR = "#8894a1";
const MAX_SLICES = 7;
const MAX_BARS = 12;

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

/** Revenue donut: one colour per row by revenue rank, the rest folded into a grey slice */
function donut(rows: ShareRow[], other: string) {
  const positive = rows.filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount);
  const top = positive.slice(0, MAX_SLICES);
  const rest = positive.slice(MAX_SLICES);
  const slices = top.map((r, i) => ({ name: r.label, amount: r.amount, color: SLICE_COLORS[i % SLICE_COLORS.length] }));
  const colors = new Map(top.map((r, i) => [r.key, SLICE_COLORS[i % SLICE_COLORS.length]]));
  if (rest.length) {
    slices.push({ name: other, amount: rest.reduce((n, r) => n + r.amount, 0), color: OTHER_COLOR });
    for (const r of rest) colors.set(r.key, OTHER_COLOR);
  }
  return { slices, colors, total: rows.reduce((n, r) => n + r.amount, 0) };
}

const axisTick = { fill: "var(--color-faint)", fontSize: 10.5, fontFamily: "var(--font-mono)" };
const tooltipBox = { background: "var(--color-panel)", border: "1px solid var(--color-line)", borderRadius: 5, fontSize: 12 };

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
  // Size and panel come from the catalog model behind each SO Model (unknown when it is not in the catalog)
  const group = (key: (m: SalesReport["models"][number]) => string): ShareRow[] => {
    const g = new Map<string, ShareRow>();
    for (const m of report.models) {
      const k = key(m);
      const row = g.get(k) ?? { key: k, label: k, qty: 0, amount: 0 };
      row.qty += m.qty;
      row.amount += m.amount;
      g.set(k, row);
    }
    return [...g.values()].filter((r) => r.qty !== 0 || r.amount !== 0).sort((a, b) => b.amount - a.amount);
  };
  const bySize = group((m) => (m.sizeIn ? `${Math.round(m.sizeIn)}"` : t.unknown));
  const byPanel = group((m) => m.panel ?? t.unknown);
  const segRows = report.segments.map((s) => (s.label === "?" ? { ...s, label: t.unknown } : s));
  const toggle = (key: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (!n.delete(key)) n.add(key);
      return n;
    });

  const selectCls = "h-8 rounded-ctl border border-line bg-app px-2 text-[13px] text-fg";

  return (
    <div className="flex flex-col gap-4">
      {/* Period and distributor side by side, on the left */}
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
          <span className="num text-[12.5px] text-muted">{filter.from === filter.to ? label(filter.from) : `${label(filter.from)} – ${label(filter.to)}`}</span>
        )}
        <select aria-label={t.npp} className={cn(selectCls, filter.npp && "border-accent")} value={filter.npp ?? ""} onChange={(e) => go({ npp: e.target.value || null })}>
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
          {/* One row: units and revenue as the headline tiles (64%), the three smaller figures stacked beside them (36%) */}
          <Reveal>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,32fr)_minmax(0,32fr)_minmax(0,36fr)]">
            <HeroKpi
              tone="qty"
              label={t.kpi.qty}
              value={totals.qty}
              format={(n) => fmtNum(Math.round(n))}
              unit={t.kpi.qtyUnit}
              delta={delta(totals.qty, previous?.qty)}
              note={previous ? t.kpi.vsPrev(span) : t.kpi.noPrev}
            />
            <HeroKpi
              tone="amount"
              label={t.kpi.amount}
              value={totals.amount}
              format={money}
              delta={delta(totals.amount, previous?.amount)}
              note={previous ? t.kpi.vsPrev(span) : t.kpi.noPrev}
              title={`${fmtNum(totals.amount)} VNĐ`}
            />
            <div className="grid gap-2 max-lg:grid-cols-3">
              <SmallKpi label={t.kpi.asp} value={totals.qty > 0 ? Math.round(totals.amount / totals.qty) : null} unit="VNĐ" />
              <SmallKpi label={t.kpi.models} value={totals.models} />
              <SmallKpi label={t.kpi.customers} value={totals.customers} />
            </div>
          </div>
          </Reveal>

          <Reveal>
            <MonthChart months={report.months} money={money} />
          </Reveal>

          <div className="grid items-stretch gap-3 xl:grid-cols-2">
            <Reveal>
              <DonutTable title={t.share.npp} nameHead={t.share.nppCol} rows={report.npps} totals={totals} money={money} />
            </Reveal>
            <Reveal>
              <NppCompare rows={report.npps} months={report.months.map((m) => m.month)} prevMonths={report.prevMonths} money={money} />
            </Reveal>
          </div>

          <Segments rows={segRows} totals={totals} money={money} />

          <div className="grid items-start gap-3 xl:grid-cols-2">
            <Reveal>
              <DonutTable title={t.bySize} nameHead={t.share.sizeCol} rows={bySize} totals={totals} money={money} />
            </Reveal>
            <Reveal>
              <DonutTable title={t.byPanel} nameHead={t.share.panelCol} rows={byPanel} totals={totals} money={money} />
            </Reveal>
          </div>

          <Reveal>
          <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <h2 className="text-[17px] font-bold text-fg">{t.models.title}</h2>
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
                                <Link href={`/products/${encodeURIComponent(m.productSlug)}`} prefetch={false} className="font-bold text-fg hover:underline">
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
                          <td className={cn(td, "num text-right font-semibold text-fg")}>
                            <CountUp value={m.qty} />
                          </td>
                          <td className={cn(td, "num text-right text-muted")}>
                            <Pct v={m.qty} total={totals.qty} />
                          </td>
                          <td className={cn(td, "num text-right font-semibold text-fg")}>
                            <CountUp value={m.amount} format={money} />
                          </td>
                          <td className={cn(td, "num text-right text-muted")}>
                            <Pct v={m.amount} total={totals.amount} />
                          </td>
                          <td className={cn(td, "num text-right text-fg-2")}>{asp ? <CountUp value={asp} /> : "—"}</td>
                          <td className={cn(td, "num text-right", m.minPrice ? "text-best" : "text-faint")}>{m.minPrice ? <CountUp value={m.minPrice} /> : "—"}</td>
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
          </Reveal>

          <Dealers report={report} money={money} />
          <p className="text-[12px] text-muted">{t.note}</p>
        </>
      )}
    </div>
  );
}

/** Revenue as bars on the left axis, units as a line on the right axis; bars grow and the line rises month by month */
function MonthChart({ months, money }: { months: SalesReport["months"]; money: (n: number) => string }) {
  const t = useT(salesMessages);
  const data = useTweenRows(months, ["amount", "qty"], { stagger: 70 });
  const { hover, chartProps } = useChartHover();
  return (
    <Panel className="p-4">
      <h2 className="mb-2 text-[17px] font-bold text-fg">{t.chart.title}</h2>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 900, height: 260 }}>
          <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} {...chartProps}>
            <CartesianGrid vertical={false} stroke="var(--color-line-2)" />
            <XAxis dataKey="month" tickFormatter={label} tickLine={false} axisLine={false} tick={axisTick} />
            <YAxis yAxisId="amount" width={60} tickLine={false} axisLine={false} tickFormatter={(v: number) => money(v)} tick={axisTick} />
            <YAxis yAxisId="qty" orientation="right" width={52} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtNum(Math.round(v))} tick={axisTick} />
            <Tooltip
              {...tooltipFollow}
              cursor={{ fill: "var(--color-accent-tint)" }}
              contentStyle={tooltipBox}
              labelStyle={{ color: "var(--color-fg)", fontWeight: 600 }}
              itemStyle={{ color: "var(--color-fg-2)", fontFamily: "var(--font-mono)" }}
              labelFormatter={(m) => label(String(m))}
              formatter={(v, name) => [name === t.chart.amount ? `${fmtNum(Math.round(Number(v)))} VNĐ` : fmtNum(Math.round(Number(v))), name]}
            />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 12, color: "var(--color-fg-2)" }} />
            <Bar yAxisId="amount" dataKey="amount" name={t.chart.amount} fill="var(--color-accent)" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false}>
              {data.map((_, i) => (
                <Cell key={i} fillOpacity={dimmed(hover, i)} style={cellFade} />
              ))}
            </Bar>
            <Line
              yAxisId="qty"
              dataKey="qty"
              name={t.chart.qty}
              type="monotone"
              stroke="var(--color-aorus)"
              strokeWidth={2.5}
              dot={{ r: DOT_R, fill: "var(--color-aorus)", strokeWidth: 0 }}
              activeDot={{ r: ACTIVE_DOT_R, fill: "var(--color-aorus)", strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

// Gradient tiles as on the vnpromotion dashboard: units deep cyan -> violet, revenue violet -> magenta -> pink
const HERO = {
  qty: "bg-linear-to-br from-[#0086a8] via-[#3b5fd0] to-[#7a2bc8]",
  amount: "bg-linear-to-br from-[#7a2bc8] via-[#c4008f] to-[#d6337f]",
} as const;

function HeroKpi({
  tone,
  label,
  value,
  format,
  unit,
  delta,
  note,
  title,
}: {
  tone: keyof typeof HERO;
  label: string;
  value: number;
  format: (n: number) => string;
  unit?: string;
  delta: number | null;
  note: string;
  title?: string;
}) {
  return (
    <div className={cn("flex min-h-28 min-w-0 flex-col justify-center gap-1.5 rounded-[14px] px-5 py-4 text-white md:px-6", HERO[tone])}>
      <span className="text-[13.5px] font-medium text-white/85">{label}</span>
      <span className="num text-[30px] leading-tight font-extrabold tracking-[-0.02em] md:text-[40px]" title={title}>
        <CountUp value={value} format={format} />
        {unit && <span className="ml-1.5 font-sans text-[14px] font-medium text-white/80">{unit}</span>}
      </span>
      <span className="text-[12.5px] text-white/85">
        {delta !== null && (
          <span className="num mr-1.5 inline-block rounded-full bg-white/20 px-2 py-0.5 font-semibold text-white">{fmtPct(delta)}</span>
        )}
        {note}
      </span>
    </div>
  );
}

function SmallKpi({ label, value, unit }: { label: string; value: number | null; unit?: string }) {
  return (
    <Panel className="flex min-w-0 items-center justify-between gap-3 px-3.5 py-2 max-lg:flex-col max-lg:items-start max-lg:gap-0.5">
      <div className="truncate text-[12px] text-muted" title={label}>
        {label}
      </div>
      <div className="num shrink-0 text-[16px] leading-tight font-semibold text-fg">
        {value === null ? "—" : <CountUp value={value} />}
        {value !== null && unit && <span className="ml-1 font-sans text-[11px] font-normal text-muted">{unit}</span>}
      </div>
    </Panel>
  );
}

/** Units, revenue and revenue share per row, with the revenue donut beside the table (vnpromotion dashboard layout) */
function DonutTable({
  title,
  nameHead,
  rows,
  totals,
  money,
}: {
  title: string;
  nameHead: string;
  rows: ShareRow[];
  totals: { qty: number; amount: number };
  money: (n: number) => string;
}) {
  const t = useT(salesMessages);
  const model = donut(rows, t.share.other);
  const sorted = [...rows].sort((a, b) => b.amount - a.amount);
  return (
    <Panel className="overflow-hidden">
      <h2 className="border-b border-line px-4 py-3 text-[17px] font-bold text-fg">{title}</h2>
      <div className="flex flex-col items-center gap-4 p-3 sm:flex-row sm:items-center">
        <div className="w-full min-w-0 flex-1 overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-[12.5px] whitespace-nowrap">
            <thead>
              <tr className="text-[11.5px] text-muted">
                {[nameHead, t.share.qty, t.share.amount, t.models.share].map((h, i) => (
                  <th key={h} scope="col" className={cn("border-b border-line bg-head px-3 py-2 font-semibold", i ? "text-right" : "text-left")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const td = cn("border-b border-line-2 px-3 py-2", i % 2 === 0 ? "bg-row-a" : "bg-row-b");
                return (
                  <tr key={r.key}>
                    <td className={cn(td, "font-semibold text-fg")}>
                      <span className="inline-flex items-center gap-2">
                        <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: model.colors.get(r.key) ?? OTHER_COLOR }} />
                        {r.label}
                      </span>
                    </td>
                    <td className={cn(td, "num text-right text-fg")}>
                      <CountUp value={r.qty} />
                    </td>
                    <td className={cn(td, "num text-right font-semibold text-fg")} title={`${fmtNum(r.amount)} VNĐ`}>
                      <CountUp value={r.amount} format={money} />
                    </td>
                    <td className={cn(td, "num text-right text-key")}>
                      <Pct v={r.amount} total={totals.amount} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="bg-head px-3 py-2 text-fg">{t.share.total}</td>
                <td className="num bg-head px-3 py-2 text-right text-fg">
                  <CountUp value={totals.qty} />
                </td>
                <td className="num bg-head px-3 py-2 text-right text-fg">
                  <CountUp value={totals.amount} format={money} />
                </td>
                <td className="num bg-head px-3 py-2 text-right text-muted">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <Donut model={model} label={t.share.donutLabel(nameHead)} money={money} />
      </div>
    </Panel>
  );
}

function Donut({ model, label: aria, money }: { model: ReturnType<typeof donut>; label: string; money: (n: number) => string }) {
  const t = useT(salesMessages);
  // Slices sweep in one after another (150ms apart); a transparent slice fills the part of the ring not drawn yet
  const full = model.slices.reduce((n, s) => n + s.amount, 0);
  const grown = useTweens(
    model.slices.map((s) => s.amount),
    { stagger: 150 },
  );
  const drawn = grown.reduce((n, v) => n + v, 0);
  const data = [...model.slices.map((s, i) => ({ ...s, amount: grown[i] })), { name: "", amount: Math.max(0, full - drawn), color: "transparent" }];
  if (!model.slices.length) return null;
  return (
    <figure className="relative size-[130px] shrink-0" aria-label={aria}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 130, height: 130 }}>
        <PieChart>
          <Tooltip
            {...tooltipFollow}
            contentStyle={tooltipBox}
            itemStyle={{ color: "var(--color-fg-2)", fontFamily: "var(--font-mono)" }}
            formatter={(v, name) => [`${fmtNum(Math.round(Number(v)))} VNĐ · ${pct(Number(v), model.total)}`, name]}
          />
          <Pie
            data={data}
            dataKey="amount"
            nameKey="name"
            innerRadius={42}
            outerRadius={64}
            startAngle={90}
            endAngle={-270}
            strokeWidth={0}
            isAnimationActive={false}
          >
            {data.map((s, i) => (
              <Cell key={s.name || `rest${i}`} fill={s.color} style={s.name ? undefined : { pointerEvents: "none" }} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <figcaption className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[11px] text-muted">{t.share.donutTotal}</span>
        <span className="num text-[13px] font-extrabold text-fg">
          <CountUp value={model.total} format={money} />
        </span>
      </figcaption>
    </figure>
  );
}

/** Segment table and segment share side by side; hovering a row lights its bar and the other way round */
function Segments({ rows, totals, money }: { rows: (ShareRow & { models: number })[]; totals: { qty: number; amount: number }; money: (n: number) => string }) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div className="grid items-stretch gap-3 xl:grid-cols-2">
      <Reveal>
        <SegmentTable rows={rows} totals={totals} money={money} hover={hover} setHover={setHover} />
      </Reveal>
      <Reveal>
        <SegmentShare rows={rows} money={money} hover={hover} setHover={setHover} />
      </Reveal>
    </div>
  );
}

type HoverProps = { hover: string | null; setHover: (key: string | null) => void };
const REST_KEY = "__rest";

/** Segment, units, revenue, share — the dashboard's segment table (one CAT here: LCD) */
function SegmentTable({
  rows,
  totals,
  money,
  hover,
  setHover,
}: { rows: (ShareRow & { models: number })[]; totals: { qty: number; amount: number }; money: (n: number) => string } & HoverProps) {
  const t = useT(salesMessages);
  const rest = new Set(shareBars(rows, "").rest.map((r) => r.key));
  return (
    <Panel className="flex flex-col overflow-hidden">
      <h2 className="border-b border-line px-4 py-3 text-[17px] font-bold text-fg">{t.share.segment}</h2>
      <div className="max-h-[460px] flex-1 overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-[12.5px] whitespace-nowrap">
          <thead className="sticky top-0 z-[1]">
            <tr className="text-[11.5px] text-muted">
              {[t.share.segmentCol, t.share.qty, t.share.amount, t.models.share, t.share.models].map((h, i) => (
                <th key={h} scope="col" className={cn("border-b border-line bg-head px-3 py-2 font-semibold", i ? "text-right" : "text-left")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const lit = hover === r.key || (hover === REST_KEY && rest.has(r.key));
              const td = cn("border-b border-line-2 px-3 py-2 transition-colors", lit ? "bg-accent-tint" : i % 2 === 0 ? "bg-row-a" : "bg-row-b");
              return (
                <tr key={r.key} onMouseEnter={() => setHover(rest.has(r.key) ? REST_KEY : r.key)} onMouseLeave={() => setHover(null)}>
                  <td className={cn(td, "font-semibold text-fg")}>{r.label}</td>
                  <td className={cn(td, "num text-right text-fg")}>
                    <CountUp value={r.qty} />
                  </td>
                  <td className={cn(td, "num text-right font-semibold text-fg")} title={`${fmtNum(r.amount)} VNĐ`}>
                    <CountUp value={r.amount} format={money} />
                  </td>
                  <td className={cn(td, "num text-right text-key")}>
                    <Pct v={r.amount} total={totals.amount} />
                  </td>
                  <td className={cn(td, "num text-right text-muted")}>
                    <CountUp value={r.models} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="sticky bottom-0">
            <tr className="font-semibold">
              <td className="bg-head px-3 py-2 text-fg">{t.share.total}</td>
              <td className="num bg-head px-3 py-2 text-right text-fg">
                <CountUp value={totals.qty} />
              </td>
              <td className="num bg-head px-3 py-2 text-right text-fg">
                <CountUp value={totals.amount} format={money} />
              </td>
              <td className="num bg-head px-3 py-2 text-right text-muted">100%</td>
              <td className="bg-head" />
            </tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  );
}

/** The largest 11 segments by revenue and one grey bar for the rest, shares in % of revenue */
function shareBars(rows: ShareRow[], others: string | ((n: number) => string)) {
  const sold = rows.filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount);
  const total = sold.reduce((n, r) => n + r.amount, 0);
  const shown = sold.length > MAX_BARS ? sold.slice(0, MAX_BARS - 1) : sold;
  const rest = sold.slice(shown.length);
  const share = (amount: number) => (total ? (amount / total) * 100 : 0);
  const bars = [
    ...shown.map((r) => ({ key: r.key, name: r.label, amount: r.amount, share: share(r.amount), other: false })),
    ...(rest.length
      ? [{ key: REST_KEY, name: typeof others === "function" ? others(rest.length) : others, amount: rest.reduce((n, r) => n + r.amount, 0), share: 0, other: true }]
      : []),
  ].map((b) => (b.other ? { ...b, share: share(b.amount) } : b));
  return { bars, rest };
}

/** Share of each segment in revenue: horizontal bars that run out one after another */
function SegmentShare({ rows, money, hover, setHover }: { rows: ShareRow[]; money: (n: number) => string } & HoverProps) {
  const t = useT(salesMessages);
  const { bars: target } = shareBars(rows, t.share.others);
  const bars = useTweenRows(target, ["share", "amount"], { stagger: 60 });
  const height = Math.max(160, bars.length * 30 + 20);
  return (
    <Panel className="flex flex-col overflow-hidden">
      <div className="flex items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-[17px] font-bold text-fg">{t.share.segmentShare}</h2>
        <span className="text-[11.5px] text-muted">{t.share.segmentShareNote}</span>
      </div>
      <div className="flex-1 p-3" style={{ minHeight: height }}>
        <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 600, height }}>
          <BarChart
            data={bars}
            layout="vertical"
            margin={{ top: 0, right: 48, bottom: 0, left: 0 }}
            onMouseMove={(st) => setHover(st.activeTooltipIndex == null ? null : (bars[Number(st.activeTooltipIndex)]?.key ?? null))}
            onMouseLeave={() => setHover(null)}
          >
            <CartesianGrid horizontal={false} stroke="var(--color-line-2)" />
            {/* Fixed to the real largest share so the bars grow instead of the axis */}
            <XAxis type="number" hide domain={[0, Math.max(1, ...target.map((b) => b.share))]} />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--color-fg-2)", fontSize: 11.5 }}
              tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)}
            />
            <Tooltip
              {...tooltipFollow}
              cursor={{ fill: "var(--color-accent-tint)" }}
              contentStyle={tooltipBox}
              itemStyle={{ color: "var(--color-fg-2)", fontFamily: "var(--font-mono)" }}
              formatter={(_v, _n, item) => [`${money(item.payload.amount)} · ${item.payload.share.toFixed(1)}%`, t.share.amount]}
            />
            <Bar dataKey="share" radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
              {bars.map((b, i) => (
                <Cell
                  key={b.key}
                  fill={b.other ? OTHER_COLOR : SLICE_COLORS[Math.min(i, SLICE_COLORS.length - 1)]}
                  fillOpacity={hover === null || hover === b.key ? 1 : 0.45}
                  style={cellFade}
                />
              ))}
              <LabelList dataKey="share" position="right" formatter={(v) => `${Number(v).toFixed(1)}%`} style={{ fill: "var(--color-fg-2)", fontSize: 11, fontFamily: "var(--font-mono)" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

const CUR_BAR = "var(--color-accent)";
const PREV_BAR = "color-mix(in oklab, var(--color-accent) 35%, transparent)";
const CUR_LINE = "var(--color-aorus)";
const PREV_LINE = "color-mix(in oklab, var(--color-aorus) 45%, transparent)";
const range = (ms: string[]) => (ms.length ? (ms.length === 1 ? label(ms[0]) : `${label(ms[0])} – ${label(ms[ms.length - 1])}`) : "");

/** Combo chart of this period against the previous one: revenue bars (left axis), units lines (right axis) */
function CompareChart({ data, money, height = 250 }: { data: { name: string; amount: number; prevAmount: number; qty: number; prevQty: number }[]; money: (n: number) => string; height?: number }) {
  const t = useT(salesMessages);
  const rows = useTweenRows(data, ["amount", "prevAmount", "qty", "prevQty"], { stagger: 70 });
  const { hover, chartProps } = useChartHover();
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height }}>
        <ComposedChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2} {...chartProps}>
          <CartesianGrid vertical={false} stroke="var(--color-line-2)" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ ...axisTick, fill: "var(--color-fg-2)" }} interval={0} />
          <YAxis yAxisId="amount" width={76} tickLine={false} axisLine={false} tickFormatter={(v: number) => money(v)} tick={axisTick} />
          <YAxis yAxisId="qty" orientation="right" width={48} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtNum(Math.round(v))} tick={axisTick} />
          <Tooltip
            {...tooltipFollow}
            cursor={{ fill: "var(--color-accent-tint)" }}
            contentStyle={tooltipBox}
            labelStyle={{ color: "var(--color-fg)", fontWeight: 600 }}
            itemStyle={{ color: "var(--color-fg-2)", fontFamily: "var(--font-mono)" }}
            formatter={(v, name) => [name === t.share.amountCur || name === t.share.amountPrev ? `${fmtNum(Math.round(Number(v)))} VNĐ` : fmtNum(Math.round(Number(v))), name]}
          />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11.5, color: "var(--color-fg-2)" }} />
          {(["amount", "prevAmount"] as const).map((k) => (
            <Bar
              key={k}
              yAxisId="amount"
              dataKey={k}
              name={k === "amount" ? t.share.amountCur : t.share.amountPrev}
              fill={k === "amount" ? CUR_BAR : PREV_BAR}
              radius={[3, 3, 0, 0]}
              maxBarSize={34}
              isAnimationActive={false}
            >
              {rows.map((_, i) => (
                <Cell key={i} fillOpacity={dimmed(hover, i)} style={cellFade} />
              ))}
            </Bar>
          ))}
          <Line
            yAxisId="qty"
            dataKey="qty"
            name={t.share.qtyCur}
            stroke={CUR_LINE}
            strokeWidth={2.5}
            dot={{ r: DOT_R, fill: CUR_LINE, strokeWidth: 0 }}
            activeDot={{ r: ACTIVE_DOT_R, fill: CUR_LINE, strokeWidth: 0 }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="qty"
            dataKey="prevQty"
            name={t.share.qtyPrev}
            stroke={PREV_LINE}
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={{ r: 3, fill: PREV_LINE, strokeWidth: 0 }}
            activeDot={{ r: ACTIVE_DOT_R - 0.5, fill: PREV_LINE, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (!prev) return <span className="text-faint">—</span>;
  const d = ((cur - prev) / Math.abs(prev)) * 100;
  return <span className={cn("num font-semibold", d >= 0 ? "text-best" : "text-up")}>{fmtPct(d)}</span>;
}

/** Distributors, this period against the previous one */
function NppCompare({
  rows,
  months,
  prevMonths,
  money,
}: {
  rows: SalesReport["npps"];
  months: string[];
  prevMonths: string[];
  money: (n: number) => string;
}) {
  const t = useT(salesMessages);
  return (
    <Panel className="flex flex-col overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-[17px] font-bold text-fg">{t.share.compareTitle}</h2>
        <span className="num text-[11.5px] text-muted">{t.share.periods(range(months), range(prevMonths))}</span>
      </div>
      <div className="flex-1 p-3">
        <CompareChart data={rows.map((r) => ({ name: r.label, amount: r.amount, prevAmount: r.prevAmount, qty: r.qty, prevQty: r.prevQty }))} money={money} />
      </div>
    </Panel>
  );
}

/** Dealers (filter by PIC; units and revenue only) and, beside them, the selected dealer against the previous period */
function Dealers({ report, money }: { report: SalesReport; money: (n: number) => string }) {
  const t = useT(salesMessages);
  const [pic, setPic] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const list = report.customers.filter((c) => !pic || c.pic === pic);
  const shown = all ? list : list.slice(0, 20);
  const sel = list.find((c) => c.key === picked) ?? list[0] ?? null;
  const months = report.months.map((m) => m.month);
  const chart = sel
    ? months.map((m, i) => ({
        name: t.share.monthPair(Number(m.slice(5)), Number(report.prevMonths[i]?.slice(5) ?? 0)),
        amount: sel.series.cur[i]?.amount ?? 0,
        prevAmount: sel.series.prev[i]?.amount ?? 0,
        qty: sel.series.cur[i]?.qty ?? 0,
        prevQty: sel.series.prev[i]?.qty ?? 0,
      }))
    : [];
  return (
    <div className="grid items-stretch gap-3 xl:grid-cols-2">
      <Reveal>
      <Panel className="flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-[17px] font-bold text-fg">{t.customers.title}</h2>
          <select
            aria-label={t.share.pic}
            value={pic}
            onChange={(e) => {
              setPic(e.target.value);
              setPicked(null);
            }}
            className={cn("h-8 rounded-ctl border bg-app px-2 text-[13px] text-fg", pic ? "border-accent" : "border-line")}
          >
            <option value="">{t.share.allPic}</option>
            {report.pics.map((p) => (
              <option key={p} value={p}>
                {t.share.pic} · {p}
              </option>
            ))}
          </select>
        </div>
        {list.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-muted">{t.share.noDealer}</p>
        ) : (
          <div className="max-h-[560px] flex-1 overflow-auto">
            <table className="w-full border-separate border-spacing-0 text-[12.5px] whitespace-nowrap">
              <thead className="sticky top-0 z-[1]">
                <tr className="text-[11.5px] text-muted">
                  {[t.models.rank, t.customers.name, t.share.qty, t.share.amount].map((h, i) => (
                    <th key={h} scope="col" className={cn("border-b border-line bg-head px-3 py-2 font-semibold", i >= 2 ? "text-right" : "text-left")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((c, i) => {
                  const on = sel?.key === c.key;
                  const td = cn("border-b border-line-2 px-3 py-2", on ? "bg-accent-tint" : i % 2 === 0 ? "bg-row-a" : "bg-row-b");
                  return (
                    <tr key={c.key} onClick={() => setPicked(c.key)} aria-selected={on} className="cursor-pointer hover:[&>td]:bg-accent-tint">
                      <td className={cn(td, "num w-10 text-faint")}>{i + 1}</td>
                      <td className={cn(td, "font-semibold text-fg")}>
                        <button type="button" className="text-left hover:underline" onClick={() => setPicked(c.key)}>
                          {c.label}
                        </button>
                      </td>
                      <td className={cn(td, "num text-right font-semibold text-fg")}>
                        <CountUp value={c.qty} />
                      </td>
                      <td className={cn(td, "num text-right text-fg-2")} title={`${fmtNum(c.amount)} VNĐ`}>
                        <CountUp value={c.amount} format={money} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {list.length > 20 && (
          <div className="border-t border-line px-4 py-2.5 text-right text-[12px]">
            <button type="button" onClick={() => setAll((v) => !v)} className="font-semibold text-key hover:underline">
              {all ? t.models.showLess : t.share.showAllDealers(list.length)}
            </button>
          </div>
        )}
      </Panel>
      </Reveal>

      <Reveal>
      <Panel className="flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="min-w-0 truncate text-[17px] font-bold text-fg">{sel ? t.share.dealerCompare(sel.label) : t.share.compareTitle}</h2>
          <span className="num text-[11.5px] text-muted">{t.share.periods(range(months), range(report.prevMonths))}</span>
        </div>
        {sel ? (
          <div className="flex flex-1 flex-col gap-3 p-3">
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              {[
                { l: t.share.qty, cur: sel.qty, prev: sel.prevQty, f: fmtNum },
                { l: t.share.amount, cur: sel.amount, prev: sel.prevAmount, f: money },
              ].map((k) => (
                <div key={k.l} className="rounded-ctl border border-line bg-app px-3 py-2">
                  <div className="text-muted">{k.l}</div>
                  <div className="num mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[16px] font-semibold text-fg">
                    <CountUp value={k.cur} format={(n) => k.f(Math.round(n))} />
                    <span className="text-[12px] font-normal text-muted">
                      {t.share.prev}: {k.f(k.prev)}
                    </span>
                    <span className="text-[12px]">
                      <Delta cur={k.cur} prev={k.prev} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-[11.5px] text-muted">
              {sel.npp ?? "—"}
              {sel.pic ? ` · ${t.share.pic} ${sel.pic}` : ""}
            </div>
            <CompareChart data={chart} money={money} height={280} />
            <p className="text-[11.5px] text-faint">{t.share.dealerHint}</p>
          </div>
        ) : (
          <p className="px-4 py-6 text-[13px] text-muted">{t.share.noDealer}</p>
        )}
      </Panel>
      </Reveal>
    </div>
  );
}
