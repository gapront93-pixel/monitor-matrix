"use client";

import { ArrowLeftRightIcon, ChevronDownIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ErrorState } from "@/components/ui/states";
import { useLocale, useT } from "@/lib/i18n/client";
import { importsMessages } from "@/lib/i18n/messages/imports";
import {
  ALL_FILTER,
  DIMS,
  EMPTY_FILTER,
  HZ_BUCKETS,
  PRESETS,
  ROW_ONLY,
  SIZE_BUCKETS,
  YEARS,
  buildPivot,
  dimOptions,
  filterCount,
  hasKids,
  headLabel,
  heatMax,
  hzLabel,
  importerShort,
  isRevCol,
  isTotalCol,
  modelTable,
  options,
  resLabel,
  visibleRows,
  yearSeries,
  type ChartFilter,
  type Dim,
  type ImportData,
  type Measure,
  type ModelRow,
  type MultiSel,
  type PivotFilter,
  type PivotSpec,
  type PivotTable,
  type Year,
} from "@/lib/imports";
import { cn } from "@/lib/utils";

const HIGHLIGHT = "Gigabyte";

// One strong hue per year, far apart so the years never blur: violet, AORUS orange, GIGABYTE cyan.
// Bars carry the value, lines (a lighter tint of the same hue, dots outlined) the units
const YEAR_COLORS: Record<Year, { bar: string; line: string }> = {
  2024: { bar: "#7b5cff", line: "#b9a6ff" },
  2025: { bar: "#ff7a1a", line: "#ffb36b" },
  2026: { bar: "#00a3e0", line: "#e040e8" },
};

function useNumbers() {
  const locale = useLocale();
  return useMemo(() => {
    const tag = locale === "vi" ? "vi-VN" : "en-US";
    const f0 = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 });
    const f1 = new Intl.NumberFormat(tag, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return {
      num: (n: number) => f0.format(n),
      // 20,0M · 250,0K, as in the design
      compact: (n: number) => (n >= 1e6 ? `${f1.format(n / 1e6)}M` : n >= 1e3 ? `${f1.format(n / 1e3)}K` : f0.format(n)),
      dec: (n: number) => f1.format(n),
    };
  }, [locale]);
}

export function ImportView() {
  const t = useT(importsMessages);
  const [data, setData] = useState<ImportData | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<ChartFilter>(EMPTY_FILTER);

  useEffect(() => {
    let live = true;
    fetch("/api/nhap-khau?f=raw")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: ImportData) => live && setData(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  if (failed) return <ErrorState title={t.loadError} />;

  return (
    <div className="flex flex-col gap-5">
      <FilterBar filter={filter} setFilter={setFilter} data={data} />
      {!data ? (
        <div className="py-20 text-center text-[14px] text-muted">{t.loading}</div>
      ) : (
        <>
          <YearChart data={data} filter={filter} />
          <PivotBuilder data={data} />
          <ModelTable data={data} />
        </>
      )}
    </div>
  );
}

// --- Filter bar of the chart: years, then the dimension dropdowns ---

function chipCls(on: boolean) {
  return cn(
    "h-[30px] min-w-14 rounded-[6px] border px-2.5 text-[14px] font-medium transition-colors",
    on ? "border-accent bg-accent font-semibold text-on-accent" : "border-line bg-app text-fg-2 hover:border-line-hover",
  );
}

function FilterBar({ filter, setFilter, data }: { filter: ChartFilter; setFilter: (f: ChartFilter) => void; data: ImportData | null }) {
  const t = useT(importsMessages);
  const opts = useMemo(() => (data ? options(data) : null), [data]);
  const toggleYear = (y: Year) => {
    const on = filter.years.includes(y);
    // At least one year stays chosen
    if (on && filter.years.length === 1) return;
    setFilter({ ...filter, years: on ? filter.years.filter((x) => x !== y) : [...filter.years, y].sort() });
  };
  const n = filterCount(filter);
  const select = (label: string, value: string, onChange: (v: string) => void, list: { v: string; l: string }[]) => (
    <label key={label} className={cn("flex h-8 items-center gap-2 rounded-[6px] border bg-app pr-1 pl-2.5", value !== "" ? "border-accent" : "border-line")}>
      <span className="text-[14px] text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-[30px] max-w-[170px] cursor-pointer bg-transparent text-[15px] text-fg outline-none">
        <option value="">{t.all}</option>
        {list.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <section className="flex flex-col gap-3 rounded-[10px] border border-line bg-panel px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-16 text-[14px] text-muted">{t.year}</span>
        {YEARS.map((y) => (
          <button key={y} type="button" aria-pressed={filter.years.includes(y)} onClick={() => toggleYear(y)} className={chipCls(filter.years.includes(y))}>
            {y}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="w-16 text-[14px] text-muted">{t.filters}</span>
        {opts && (
          <>
            {select(t.brand, filter.brand, (v) => setFilter({ ...filter, brand: v }), opts.brands2026.map((b) => ({ v: b, l: b })))}
            {select(
              t.size,
              filter.size === null ? "" : String(filter.size),
              (v) => setFilter({ ...filter, size: v === "" ? null : Number(v) }),
              t.sizeBuckets.slice(0, SIZE_BUCKETS).map((l, i) => ({ v: String(i), l })),
            )}
            {select(t.panel, filter.panel, (v) => setFilter({ ...filter, panel: v }), opts.panels2026.map((p) => ({ v: p, l: p })))}
            {select(t.res, filter.res, (v) => setFilter({ ...filter, res: v }), opts.res2026.map((p) => ({ v: p, l: p })))}
            {select(
              t.hz,
              filter.hz === null ? "" : String(filter.hz),
              (v) => setFilter({ ...filter, hz: v === "" ? null : Number(v) }),
              t.hzBuckets.slice(0, HZ_BUCKETS).map((l, i) => ({ v: String(i), l })),
            )}
          </>
        )}
        <input
          value={filter.search}
          onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          placeholder={t.search}
          aria-label={t.search}
          className="h-8 max-w-[320px] min-w-[220px] flex-1 rounded-[6px] border border-line bg-app px-3 text-[15px] text-fg outline-none focus:border-accent"
        />
        {n > 0 && (
          <button
            type="button"
            onClick={() => setFilter({ ...EMPTY_FILTER, years: filter.years })}
            className="h-8 rounded-[6px] border border-accent/40 bg-accent-tint px-3 text-[14px] text-key hover:border-accent"
          >
            {t.clear(n)}
          </button>
        )}
      </div>
    </section>
  );
}

// --- Monthly chart; with several years each month shows one bar and one line point per year ---

function YearChart({ data, filter }: { data: ImportData; filter: ChartFilter }) {
  const t = useT(importsMessages);
  const { num, compact } = useNumbers();
  const years = YEARS.filter((y) => filter.years.includes(y));
  const series = useMemo(() => yearSeries(data, filter), [data, filter]);
  const rows = series.map((s) => {
    const o: Record<string, number | string | null> = { name: t.monthChip(s.month) };
    for (const y of years) {
      o[`rev${y}`] = s.byYear[y]?.rev ?? null;
      o[`qty${y}`] = s.byYear[y]?.qty ?? null;
    }
    return o;
  });
  const tick = { fontSize: 12, fontFamily: "var(--font-mono)" };
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-[10px] border border-line bg-panel px-5 py-4.5">
      <h2 className="text-[22px] text-fg">{t.compare.title}</h2>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1000, height: 300 }}>
          <ComposedChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke="var(--color-line-2)" strokeDasharray="3 3" />
            <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: "var(--color-line)" }} tick={{ ...tick, fill: "var(--color-fg-2)" }} />
            <YAxis yAxisId="rev" width={64} tickLine={false} axisLine={false} tickFormatter={(v: number) => compact(v)} tick={{ ...tick, fill: "var(--color-imp-rev)" }} />
            <YAxis yAxisId="qty" orientation="right" width={64} tickLine={false} axisLine={false} tickFormatter={(v: number) => compact(v)} tick={{ ...tick, fill: "var(--color-imp-qty)" }} />
            <Tooltip
              cursor={{ fill: "var(--color-accent-tint)" }}
              contentStyle={{ background: "var(--color-head)", border: "1px solid var(--color-line)", borderRadius: 6, fontSize: 12.5 }}
              labelStyle={{ color: "var(--color-fg)", fontWeight: 600 }}
              itemStyle={{ fontFamily: "var(--font-mono)" }}
              formatter={(v, key) => {
                const k = String(key);
                const y = Number(k.slice(3));
                return k.startsWith("rev") ? [`${num(Number(v))} USD`, `${t.compare.rev} ${y}`] : [`${num(Number(v))} ${t.compare.unit}`, `${t.compare.qty} ${y}`];
              }}
            />
            {years.map((y) => (
              <Bar key={`b${y}`} yAxisId="rev" dataKey={`rev${y}`} fill={YEAR_COLORS[y].bar} radius={[3, 3, 0, 0]} maxBarSize={years.length > 1 ? 22 : 44} isAnimationActive={false} />
            ))}
            {years.map((y) => (
              <Line
                key={`l${y}`}
                yAxisId="qty"
                dataKey={`qty${y}`}
                stroke={YEAR_COLORS[y].line}
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: "var(--color-panel)", stroke: YEAR_COLORS[y].line, strokeWidth: 2 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {/* Legend under the chart: one bar swatch and one line swatch per year */}
      <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[13px] text-fg-2">
        {years.map((y) => (
          <li key={y} className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-3 rounded-[2px]" style={{ background: YEAR_COLORS[y].bar }} />
              {t.compare.revYear(y)}
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-[3px] w-[18px] rounded-[2px]" style={{ background: YEAR_COLORS[y].line }} />
              {t.compare.qtyYear(y)}
            </span>
          </li>
        ))}
        {years.includes(2026) && <li className="text-[12px] text-faint">· {t.compare.partial}</li>}
      </ul>
    </section>
  );
}

// --- Pivot builder: rows / sub-rows / columns / measure, filters on every dimension, presets of the workbook ---

function PivotBuilder({ data }: { data: ImportData }) {
  const t = useT(importsMessages);
  const opts = useMemo(() => options(data), [data]);
  const dims = useMemo(() => dimOptions(data), [data]);
  const ge = (n: number) => opts.hz.filter((h) => h >= n);
  const [spec, setSpec] = useState<PivotSpec>(PRESETS[0].spec);
  const [filter, setFilter] = useState<PivotFilter>({ ...ALL_FILTER, ...PRESETS[0].filter });
  const [presetIdx, setPresetIdx] = useState<number | null>(0);
  const [open, setOpen] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<number[]>([]);
  const words = useMemo(() => ({ month: t.monthChip, quarter: t.quarterLabel, other: t.other, flat: t.flat, curved: t.curved }), [t]);

  const table = useMemo(() => buildPivot(data, filter, spec, words), [data, filter, spec, words]);
  const startCollapsed = (tb: PivotTable) => (tb.rows.length > 40 ? tb.rows.flatMap((r, i) => (r.l === 0 ? [i] : [])) : []);
  const apply = (s: PivotSpec, f: PivotFilter, idx: number | null) => {
    setSpec(s);
    setFilter(f);
    setPresetIdx(idx);
    setCollapsed(startCollapsed(buildPivot(data, f, s, words)));
  };
  const change = (s: Partial<PivotSpec>) => apply({ ...spec, ...s }, filter, null);
  const changeFilter = (f: Partial<PivotFilter>) => {
    setFilter({ ...filter, ...f });
    setPresetIdx(null);
  };
  const nFilters = Object.values(filter).filter((v) => v !== null).length;

  const ctrl = <T extends string | number>(id: string, label: string, list: { v: T; l: string }[], sel: MultiSel<T>, onChange: (v: MultiSel<T>) => void, presets: [string, T[] | null][] = [], searchable = false) => (
    <MultiSelect key={id} label={label} list={list} sel={sel} onChange={onChange} presets={presets} searchable={searchable} open={open === id} setOpen={(v) => setOpen(v ? id : null)} />
  );
  const dimSelect = (label: string, value: Dim | null, onChange: (v: Dim | null) => void, allowNone: boolean, exclude: (Dim | null)[]) => (
    <label className="flex h-8 items-center gap-2 rounded-[6px] border border-line bg-app pr-1 pl-2.5">
      <span className="text-[14px] text-muted">{label}</span>
      <select value={value ?? ""} onChange={(e) => onChange((e.target.value || null) as Dim | null)} className="h-[30px] cursor-pointer bg-transparent text-[15px] text-fg outline-none">
        {allowNone && <option value="">{t.pivot.none}</option>}
        {DIMS.filter((d) => !exclude.includes(d) || d === value)
          .filter((d) => !ROW_ONLY.includes(d) || label !== t.pivot.col)
          .map((d) => (
            <option key={d} value={d}>
              {t.dims[d]}
            </option>
          ))}
      </select>
    </label>
  );
  const groups = [...new Set(PRESETS.map((p) => p.group))];

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-[10px] border border-line bg-panel px-5 py-4.5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[22px] text-fg">{t.pivot.title}</h2>
        <p className="text-[13px] text-muted">{t.pivot.sub}</p>
      </div>

      {/* Presets: the analyses of the workbook's pivot sheets */}
      <div className="flex flex-col gap-2">
        <span className="text-[13px] text-muted">{t.pivot.presets}</span>
        <div className="grid gap-x-5 gap-y-2 lg:grid-cols-2">
          {groups.map((group) => (
            <div key={group} className="flex flex-wrap items-center gap-1.5">
              <span className="w-[120px] shrink-0 text-[12px] font-semibold tracking-[0.06em] text-faint uppercase">{t.groups[group]}</span>
              {PRESETS.map((p, i) =>
                p.group !== group ? null : (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={presetIdx === i}
                    onClick={() => apply(p.spec, { ...ALL_FILTER, ...p.filter, hz: p.gaming ? ge(p.gaming) : null }, i)}
                    className={cn(
                      "h-7 rounded-[6px] border px-2.5 text-[13px] whitespace-nowrap",
                      presetIdx === i ? "border-accent bg-accent font-semibold text-on-accent" : "border-line bg-app text-fg-2 hover:border-line-hover",
                    )}
                  >
                    {t.presetLabels[p.id] ?? p.id}
                  </button>
                ),
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Layout of the table */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        {dimSelect(t.pivot.row, spec.row, (v) => v && change({ row: v, sub: spec.sub === v ? null : spec.sub, col: spec.col === v ? null : spec.col }), false, [spec.col, spec.sub])}
        {dimSelect(t.pivot.sub2, spec.sub, (v) => change({ sub: v }), true, [spec.row, spec.col])}
        {dimSelect(t.pivot.col, spec.col, (v) => change({ col: v }), true, [spec.row, spec.sub])}
        <button
          type="button"
          disabled={!spec.col || ROW_ONLY.includes(spec.row) || !!spec.sub}
          onClick={() => spec.col && change({ row: spec.col, col: spec.row, sub: null })}
          className="flex h-8 items-center gap-1.5 rounded-[6px] border border-line px-2.5 text-[13px] text-fg-2 hover:border-line-hover disabled:opacity-40"
        >
          <ArrowLeftRightIcon aria-hidden className="size-3.5" />
          {t.pivot.swap}
        </button>
        <div className="flex h-8 items-center gap-1 rounded-[6px] border border-line bg-app p-0.5">
          <span className="px-1.5 text-[14px] text-muted">{t.pivot.measure}</span>
          {(["qty", "rev", "both", "fob", "share"] as Measure[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={spec.measure === m}
              onClick={() => change({ measure: m })}
              className={cn("h-full rounded-[4px] px-2.5 text-[13px]", spec.measure === m ? "bg-accent text-on-accent" : "text-fg-2 hover:bg-panel")}
            >
              {t.pivot.measures[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Filters on every dimension */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[14px] text-muted">{t.pivot.filters}</span>
        {ctrl("years", t.year, YEARS.map((y) => ({ v: y, l: String(y) })), filter.years, (v) => changeFilter({ years: v }), [["2024", [2024]], ["2025", [2025]], ["2026", [2026]], [t.pop.all, null]])}
        {ctrl(
          "months",
          t.time,
          Array.from({ length: 12 }, (_, i) => ({ v: i + 1, l: `${t.month} ${i + 1}` })),
          filter.months,
          (v) => changeFilter({ months: v }),
          [["Q1", [1, 2, 3]], ["Q2", [4, 5, 6]], ["Q3", [7, 8, 9]], ["Q4", [10, 11, 12]], [`${t.monthChip(1)}–${t.monthChip(9)}`, [1, 2, 3, 4, 5, 6, 7, 8, 9]], [t.pop.wholeYear, null]],
        )}
        {ctrl("sizes", t.size, dims.sizes.map((s) => ({ v: s, l: s ? `${s} inch` : "N/A" })), filter.sizes, (v) => changeFilter({ sizes: v }), [], true)}
        {ctrl("brands", t.brand, opts.brands.map((b) => ({ v: b, l: b })), filter.brands, (v) => changeFilter({ brands: v }), [], true)}
        {ctrl("res", t.res, dims.res.map((r) => ({ v: r, l: resLabel(r) })), filter.res, (v) => changeFilter({ res: v }))}
        {ctrl("panels", t.panel, dims.panels.map((p) => ({ v: p, l: p })), filter.panels, (v) => changeFilter({ panels: v }))}
        {ctrl("hz", t.hzLong, opts.hz.map((h) => ({ v: h, l: hzLabel(h) })), filter.hz, (v) => changeFilter({ hz: v }), [["≥120Hz", ge(120)], ["≥144Hz", ge(144)], ["≥165Hz", ge(165)], [t.pop.all, null]])}
        {nFilters > 0 && (
          <button type="button" onClick={() => changeFilter({ ...ALL_FILTER })} className="h-[30px] rounded-[6px] px-2.5 text-[13px] text-key hover:underline">
            {t.pivot.reset} ({nFilters})
          </button>
        )}
      </div>

      <PivotCard table={table} dimNames={t.dims} collapsed={new Set(collapsed)} setCollapsed={(rows) => setCollapsed([...rows])} />
      {(table.cols.includes(t.other) || table.groups?.some((g) => g.label === t.other)) && <p className="text-[12px] text-faint">{t.pivot.folded}</p>}
    </section>
  );
}

function PivotCard({
  table,
  dimNames,
  collapsed,
  setCollapsed,
}: {
  table: PivotTable;
  dimNames: Record<string, string>;
  collapsed: Set<number>;
  setCollapsed: (rows: Set<number>) => void;
}) {
  const t = useT(importsMessages);
  const { num, dec } = useNumbers();
  const nc = table.cols.length;
  const show = (v: number) => (table.unit === "pct" ? `${dec(v)}%` : table.unit === "usd" ? dec(v) : num(v));
  const leaf = Math.max(0, ...table.rows.map((r) => r.l));
  const mx = heatMax(table);
  const parents = table.rows.flatMap((_, ri) => (hasKids(table, ri) ? [ri] : []));
  const anyCollapsed = parents.some((ri) => collapsed.has(ri));
  const toggle = (ri: number) => {
    const next = new Set(collapsed);
    if (!next.delete(ri)) next.add(ri);
    setCollapsed(next);
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] text-faint">
          {table.ref} · {table.measure ? headLabel(table.measure, t.head) : t.bothMeasures}
        </span>
        {parents.length > 0 && (
          <button
            type="button"
            onClick={() => setCollapsed(new Set(anyCollapsed ? [] : parents))}
            className="h-6 flex-none rounded-chip border border-line px-2 text-[13px] whitespace-nowrap text-key hover:border-accent"
          >
            {anyCollapsed ? t.expandAll : t.collapseAll}
          </button>
        )}
      </div>
      <div className="max-h-[640px] overflow-auto rounded-[6px] border border-line">
        <table className="w-full border-separate border-spacing-0 text-[14px] tabular-nums">
          <thead className="sticky top-0 z-[2]">
            {table.groups && (
              <tr>
                <th className="sticky left-0 z-[3] border-b border-line bg-head" />
                {table.groups.map((gr, i) => (
                  <th key={i} colSpan={gr.span} className={cn("border-b border-l border-line bg-head px-2.5 py-2 text-center text-[15px] tracking-[0.04em]", gr.label === HIGHLIGHT ? "text-key" : "text-fg")}>
                    {gr.label}
                  </th>
                ))}
              </tr>
            )}
            <tr>
              {table.cols.map((c, i) => (
                <th
                  key={i}
                  scope="col"
                  className={cn(
                    "border-b border-line bg-head px-2.5 py-2 font-sans text-[13px] tracking-normal whitespace-nowrap",
                    i === 0 ? "sticky left-0 z-[3] text-left" : "text-right",
                    c === HIGHLIGHT ? "font-semibold text-key" : "font-medium text-muted",
                  )}
                >
                  {i === 0 ? table.rowFields.map((f) => dimNames[f] ?? f).join(" / ") : headLabel(c, t.head)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows(table, collapsed).map((ri) => {
              const r = table.rows[ri];
              const grand = r.l === -1;
              const parent = hasKids(table, ri);
              const label = String(r.c[0]);
              const hlRow = label === HIGHLIGHT;
              return (
                <tr key={ri} onClick={parent ? () => toggle(ri) : undefined} className={cn(parent && "cursor-pointer")}>
                  {Array.from({ length: nc }, (_, i) => {
                    const v = r.c[i];
                    if (i === 0) {
                      return (
                        <th
                          key={i}
                          scope="row"
                          className={cn(
                            "sticky left-0 z-[1] border-b border-line-2 py-1.5 pr-2.5 text-left font-sans tracking-normal whitespace-nowrap",
                            grand ? "bg-head" : "bg-panel",
                            grand || parent || hlRow ? "font-semibold" : "font-normal",
                            hlRow ? "text-key" : r.l > 0 ? "text-fg-2" : "text-fg",
                          )}
                          style={{ paddingLeft: 10 + (r.l > 0 ? r.l * 18 : 0) }}
                        >
                          {parent && (
                            <span aria-hidden className="mr-1 inline-block w-3 text-muted">
                              {collapsed.has(ri) ? "▸" : "▾"}
                            </span>
                          )}
                          {grand ? t.grandTotal : label}
                        </th>
                      );
                    }
                    const isNum = typeof v === "number";
                    const totalCol = isTotalCol(table, i);
                    const g = isRevCol(table, i) ? mx.r : mx.q;
                    const ratio = isNum && !grand && !totalCol && r.l === leaf && g ? (v as number) / g : 0;
                    return (
                      <td
                        key={i}
                        className={cn(
                          "border-b border-line-2 px-2.5 py-1.5 text-right whitespace-nowrap",
                          grand || parent || totalCol ? "font-semibold" : "font-normal",
                          isNum ? (hlRow || table.cols[i] === HIGHLIGHT ? "text-key" : "text-fg") : "text-faint",
                          grand ? "bg-head" : ratio > 0 ? "" : parent || totalCol ? "bg-head/60" : "",
                        )}
                        style={ratio > 0 ? { background: `rgba(0,212,230,${(0.05 + ratio * 0.5).toFixed(3)})` } : undefined}
                      >
                        {isNum ? show(v as number) : v === "" ? "" : String(v)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Multi-select popover with presets, "clear" and an optional search box ---

function MultiSelect<T extends string | number>({
  label,
  list,
  sel,
  onChange,
  presets,
  searchable,
  open,
  setOpen,
}: {
  label: string;
  list: { v: T; l: string }[];
  sel: MultiSel<T>;
  onChange: (v: MultiSel<T>) => void;
  presets: [string, T[] | null][];
  searchable: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const t = useT(importsMessages);
  const [q, setQ] = useState("");
  // Everything ticked is stored as null ("all")
  const set = (v: T[] | null) => onChange(v && v.length === list.length ? null : v);
  const same = (a: T[] | null, b: T[] | null) => (a === null || b === null ? a === b : a.length === b.length && a.every((x) => b.includes(x)));
  const preset = presets.find(([, vals]) => same(sel, vals));
  const summary =
    sel === null ? t.pop.all : preset ? preset[0] : sel.length === 0 ? t.pop.nothing : sel.length === 1 ? (list.find((o) => o.v === sel[0])?.l ?? "") : t.pop.items(sel.length);
  const shown = list.filter((o) => !q || o.l.toLowerCase().includes(q.toLowerCase())).slice(0, 200);

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setQ("");
          setOpen(!open);
        }}
        className={cn("flex h-[30px] items-center gap-2 rounded-[6px] border bg-app px-2.5 text-[14px] whitespace-nowrap text-fg", sel === null ? "border-line" : "border-accent")}
      >
        <span className="text-muted">{label}</span>
        <span>{summary}</span>
        <ChevronDownIcon aria-hidden className="size-3.5 text-faint" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute top-[34px] left-0 z-[21] flex w-[248px] flex-col gap-2 rounded-[8px] border border-line bg-head p-2.5 shadow-pop">
            {searchable && (
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t.pop.find}
                aria-label={t.pop.find}
                className="h-[30px] rounded-[6px] border border-line bg-app px-2.5 text-[14px] text-fg outline-none focus:border-accent"
              />
            )}
            <div className="flex flex-wrap gap-1">
              {presets.map(([l, vals]) => {
                const on = same(sel, vals);
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => set(vals)}
                    className={cn("h-6 rounded-chip border px-2 text-[13px] whitespace-nowrap", on ? "border-accent bg-accent-tint text-key" : "border-line text-fg-2 hover:border-line-hover")}
                  >
                    {l}
                  </button>
                );
              })}
              <button type="button" onClick={() => set([])} className="h-6 rounded-chip border border-line px-2 text-[13px] whitespace-nowrap text-muted hover:border-line-hover">
                {t.pop.none}
              </button>
            </div>
            <div className="-mx-1 flex max-h-[260px] flex-col overflow-auto">
              {shown.map((o) => {
                const on = sel === null || sel.includes(o.v);
                return (
                  <button
                    key={String(o.v)}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => {
                      const cur = sel === null ? list.map((x) => x.v) : sel;
                      set(cur.includes(o.v) ? cur.filter((x) => x !== o.v) : [...cur, o.v]);
                    }}
                    className="flex items-center gap-2 rounded-chip px-1.5 py-1 text-left text-[14px] text-fg hover:bg-panel"
                  >
                    <span
                      aria-hidden
                      className={cn("grid size-3.5 flex-none place-items-center rounded-[3px] border text-[11px] leading-none font-bold text-on-accent", on ? "border-accent bg-accent" : "border-line-hover")}
                    >
                      {on ? "✓" : ""}
                    </span>
                    <span className="flex-1 truncate">{o.l}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// --- Models and their FOB prices ---

type ModelSort = "qty" | "rev" | "fob" | "fobAsc";
const PAGE = 50;

function ModelTable({ data }: { data: ImportData }) {
  const t = useT(importsMessages);
  const m = t.models;
  const { num, dec } = useNumbers();
  const brands = useMemo(() => options(data).brands, [data]);
  const [years, setYears] = useState<Year[]>([2026]);
  const [brand, setBrand] = useState("");
  const [gaming, setGaming] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ModelSort>("qty");
  const [limit, setLimit] = useState(PAGE);
  const rows = useMemo(() => {
    const list = modelTable(data, { years, brand, gaming, search });
    const by: Record<ModelSort, (a: ModelRow, b: ModelRow) => number> = {
      qty: (a, b) => b.qty - a.qty,
      rev: (a, b) => b.rev - a.rev,
      fob: (a, b) => b.fob - a.fob,
      fobAsc: (a, b) => a.fob - b.fob,
    };
    return list.sort(by[sort]);
  }, [data, years, brand, gaming, search, sort]);
  const maxQty = Math.max(1, ...rows.map((r) => r.qty));
  const toggleYear = (y: Year) => {
    const on = years.includes(y);
    if (on && years.length === 1) return;
    setYears(on ? years.filter((x) => x !== y) : [...years, y].sort());
    setLimit(PAGE);
  };
  const th = "border-b border-line bg-head px-2.5 py-2 font-sans text-[13px] font-medium tracking-normal whitespace-nowrap text-muted";
  const spec = (r: ModelRow) => [`${r.size}"`, r.panel, resLabel(r.res), hzLabel(r.hz), r.curved ? t.curved : null].filter(Boolean).join(" · ");

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-[10px] border border-line bg-panel px-5 py-4.5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[22px] text-fg">{m.title}</h2>
        <p className="text-[13px] text-muted">{m.sub}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {YEARS.map((y) => (
          <button key={y} type="button" aria-pressed={years.includes(y)} onClick={() => toggleYear(y)} className={chipCls(years.includes(y))}>
            {y}
          </button>
        ))}
        <label className={cn("flex h-8 items-center gap-2 rounded-[6px] border bg-app pr-1 pl-2.5", brand ? "border-accent" : "border-line")}>
          <span className="text-[14px] text-muted">{t.brand}</span>
          <select
            value={brand}
            onChange={(e) => {
              setBrand(e.target.value);
              setLimit(PAGE);
            }}
            className="h-[30px] max-w-[170px] cursor-pointer bg-transparent text-[15px] text-fg outline-none"
          >
            <option value="">{t.all}</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <button type="button" aria-pressed={gaming} onClick={() => setGaming(!gaming)} className={cn(chipCls(gaming), "px-3")}>
          {m.gaming}
        </button>
        <label className="flex h-8 items-center gap-2 rounded-[6px] border border-line bg-app pr-1 pl-2.5">
          <span className="text-[14px] text-muted">{m.sortBy}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as ModelSort)} className="h-[30px] cursor-pointer bg-transparent text-[15px] text-fg outline-none">
            {(Object.keys(m.sorts) as ModelSort[]).map((k) => (
              <option key={k} value={k}>
                {m.sorts[k]}
              </option>
            ))}
          </select>
        </label>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setLimit(PAGE);
          }}
          placeholder={m.search}
          aria-label={m.search}
          className="h-8 max-w-[300px] min-w-[200px] flex-1 rounded-[6px] border border-line bg-app px-3 text-[15px] text-fg outline-none focus:border-accent"
        />
        <span className="ml-auto text-[13px] text-faint">{m.count(rows.length)}</span>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-muted">{m.none}</p>
      ) : (
        <div className="max-h-[720px] overflow-auto rounded-[6px] border border-line">
          <table className="w-full border-separate border-spacing-0 text-[14px] tabular-nums">
            <thead className="sticky top-0 z-[2]">
              <tr>
                <th className={cn(th, "w-10 text-left")}>{m.cols.rank}</th>
                <th className={cn(th, "sticky left-0 z-[3] text-left")}>{m.cols.model}</th>
                <th className={cn(th, "text-left")}>{m.cols.brand}</th>
                <th className={cn(th, "text-left")}>{m.cols.spec}</th>
                <th className={cn(th, "text-right")}>{m.cols.qty}</th>
                <th className={cn(th, "text-right")}>{m.cols.rev}</th>
                <th className={cn(th, "text-right")}>{m.cols.fob}</th>
                <th className={cn(th, "text-right")}>{m.cols.range}</th>
                <th className={cn(th, "text-right")}>{m.cols.imps}</th>
                <th className={cn(th, "text-left")}>{m.cols.top}</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((r, i) => {
                const hl = r.brand === HIGHLIGHT;
                const td = cn("border-b border-line-2 px-2.5 py-1.5 whitespace-nowrap", hl ? "bg-accent-tint" : "");
                return (
                  <tr key={`${r.brand}|${r.model}`}>
                    <td className={cn(td, "text-faint")}>{i + 1}</td>
                    <th scope="row" className={cn(td, "sticky left-0 z-[1] text-left font-sans font-semibold tracking-normal", hl ? "bg-accent-tint text-key" : "bg-panel text-fg")}>
                      {r.model}
                    </th>
                    <td className={cn(td, hl ? "font-semibold text-key" : "text-fg-2")}>{r.brand}</td>
                    <td className={cn(td, "text-[13px] text-muted")}>{spec(r)}</td>
                    <td className={cn(td, "text-right")}>
                      <span className="inline-flex items-center gap-2">
                        <span aria-hidden className="h-1.5 w-12 overflow-hidden rounded-full bg-line-2">
                          <span className="block h-full rounded-full bg-imp-rev" style={{ width: `${Math.max(3, (r.qty / maxQty) * 100)}%` }} />
                        </span>
                        <span className="font-semibold text-fg">{num(r.qty)}</span>
                      </span>
                    </td>
                    <td className={cn(td, "text-right text-fg-2")}>{num(r.rev)}</td>
                    <td className={cn(td, "text-right font-semibold text-fg")}>{dec(r.fob)}</td>
                    <td className={cn(td, "text-right text-muted")}>{r.fobMin && r.fobMin !== r.fobMax ? `${dec(r.fobMin)} – ${dec(r.fobMax)}` : r.fobMax ? dec(r.fobMax) : "—"}</td>
                    <td className={cn(td, "text-right text-fg-2")}>{r.importers}</td>
                    <td className={cn(td, "max-w-[280px] truncate text-[13px] text-fg-2")} title={r.topImporter}>
                      {importerShort(r.topImporter)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > limit && (
        <button type="button" onClick={() => setLimit(limit + PAGE)} className="self-center text-[14px] font-semibold text-key hover:underline">
          {m.showMore(rows.length - limit)}
        </button>
      )}
    </section>
  );
}
