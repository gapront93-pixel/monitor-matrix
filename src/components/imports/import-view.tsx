"use client";

import { ChevronDownIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ErrorState } from "@/components/ui/states";
import { useLocale, useT } from "@/lib/i18n/client";
import { importsMessages } from "@/lib/i18n/messages/imports";
import {
  EMPTY_FILTER,
  HZ_BUCKETS,
  SIZE_BUCKETS,
  YEARS,
  chartSlots,
  filterCount,
  gamingTable,
  hasKids,
  headLabel,
  heatMax,
  hzLabel,
  isRevCol,
  isTotalCol,
  niceMax,
  options,
  tamTable,
  visibleRows,
  type ChartFilter,
  type GamingFilter,
  type ImportData,
  type MultiSel,
  type PivotSheet,
  type PivotTable,
  type Year,
} from "@/lib/imports";
import { cn } from "@/lib/utils";

const SHEETS = ["Market TAM", "Gaming Only", "Gaming by Brand", "Analysis UTD"] as const;
type Sheet = (typeof SHEETS)[number];
const HIGHLIGHT = "Gigabyte";
const MONTH_CHIPS = 9; // T1–T9: the months 2026 has

type TableFilters = { tam: { brand: MultiSel<string>; months: MultiSel<number> }; g1: GamingFilter; g2: GamingFilter; g3: GamingFilter };

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
    };
  }, [locale]);
}

export function ImportView() {
  const t = useT(importsMessages);
  const [data, setData] = useState<ImportData | null>(null);
  const [piv, setPiv] = useState<PivotSheet[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<ChartFilter>(EMPTY_FILTER);
  const [sheet, setSheet] = useState<Sheet>("Market TAM");
  const [tf, setTf] = useState<TableFilters | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, number[]>>({});
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const get = (f: string) =>
      fetch(`/api/nhap-khau?f=${f}`).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      });
    Promise.all([get("raw"), get("piv")])
      .then(([d, p]: [ImportData, PivotSheet[]]) => {
        if (!live) return;
        const hz = options(d).hz;
        const ge = (n: number) => hz.filter((h) => h >= n);
        // Tables longer than 40 rows start collapsed to their top level
        const col: Record<string, number[]> = {};
        p.forEach((s) =>
          s.tables.forEach((tb, ti) => {
            if (tb.rows.length > 40) col[`${s.sheet}${ti}`] = tb.rows.flatMap((r, ri) => (r.l === 0 ? [ri] : []));
          }),
        );
        setData(d);
        setPiv(p);
        setCollapsed(col);
        setTf({
          tam: { brand: null, months: null },
          g1: { hz: ge(144), brand: null, year: [2026] },
          g2: { hz: ge(120), brand: null, year: [2026] },
          g3: { hz: ge(144), brand: null, year: [2026] },
        });
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  if (failed) return <ErrorState title={t.loadError} />;

  return (
    <div className="flex flex-col gap-5">
      <FilterBar filter={filter} setFilter={setFilter} data={data} />
      {!data || !piv || !tf ? (
        <div className="py-20 text-center text-[14px] text-muted">{t.loading}</div>
      ) : (
        <>
          <Chart data={data} filter={filter} setFilter={setFilter} />
          <Pivots
            data={data}
            piv={piv}
            sheet={sheet}
            setSheet={(s) => {
              setSheet(s);
              setOpen(null);
            }}
            tf={tf}
            setTf={setTf}
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            open={open}
            setOpen={setOpen}
          />
        </>
      )}
    </div>
  );
}

// --- Filter bar (applies to the chart only) ---

function chipCls(on: boolean, tone: "accent" | "year" = "accent") {
  return cn(
    "h-[30px] min-w-11 rounded-[6px] border px-2.5 text-[14px] font-medium transition-colors",
    on
      ? tone === "year"
        ? "border-imp-rev bg-imp-rev/15 text-imp-rev"
        : "border-accent bg-accent-tint text-key"
      : "border-line bg-app text-fg-2 hover:border-line-hover",
  );
}

function FilterBar({ filter, setFilter, data }: { filter: ChartFilter; setFilter: (f: ChartFilter) => void; data: ImportData | null }) {
  const t = useT(importsMessages);
  const opts = useMemo(() => (data ? options(data) : null), [data]);
  const toggleMonth = (m: number) =>
    setFilter({ ...filter, months: filter.months.includes(m) ? filter.months.filter((x) => x !== m) : [...filter.months, m].sort((a, b) => a - b) });
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
        <span className="w-16 text-[14px] text-muted">{t.month}</span>
        {Array.from({ length: MONTH_CHIPS }, (_, i) => i + 1).map((m) => (
          <button key={m} type="button" aria-pressed={filter.months.includes(m)} onClick={() => toggleMonth(m)} className={chipCls(filter.months.includes(m))}>
            {t.monthChip(m)}
          </button>
        ))}
        <span className="mx-1.5 h-5 w-px bg-line" aria-hidden />
        <span className="text-[14px] text-muted">{t.year}</span>
        {YEARS.map((y) => (
          <button key={y} type="button" aria-pressed={filter.years.includes(y)} onClick={() => toggleYear(y)} className={cn(chipCls(filter.years.includes(y), "year"), "min-w-14")}>
            {y}
          </button>
        ))}
        <button type="button" onClick={() => setFilter({ ...filter, months: [] })} className="h-[30px] px-2.5 text-[14px] text-muted hover:text-fg">
          {t.wholeYear}
        </button>
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

// --- Combo chart: value bars (left axis) + units line (right axis) ---

function Chart({ data, filter, setFilter }: { data: ImportData; filter: ChartFilter; setFilter: (f: ChartFilter) => void }) {
  const t = useT(importsMessages);
  const { num, compact } = useNumbers();
  const slots = useMemo(() => chartSlots(data, filter), [data, filter]);
  const [hover, setHover] = useState<number | null>(null);
  const mxV = niceMax(Math.max(1, ...slots.map((s) => s.rev)));
  const mxQ = niceMax(Math.max(1, ...slots.map((s) => s.qty)));
  const N = slots.length;
  const x = (i: number) => ((i + 0.5) / N) * 100;
  const ticks = [0, 1, 2, 3, 4].map((k) => k * 25);
  const multiYear = filter.years.length > 1;
  const latestMonth = Math.floor(data.meta.latest / 100);
  const tip = (i: number) => {
    const s = slots[i];
    return t.chart.tip(s.month, s.year, num(s.rev), num(s.qty), s.year === 2026 && s.month === latestMonth);
  };
  const toggleMonth = (m: number) =>
    setFilter({ ...filter, months: filter.months.includes(m) ? filter.months.filter((v) => v !== m) : [...filter.months, m].sort((a, b) => a - b) });

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-[10px] border border-line bg-panel px-5 py-4.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2.5">
        <h2 className="font-aldrich text-[22px] tracking-[0.02em] text-fg">{t.chart.title}</h2>
        <div className="flex flex-wrap items-center gap-4 text-[14px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-[2px] bg-imp-rev" aria-hidden />
            {t.chart.rev}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[3px] w-[18px] rounded-[2px] bg-imp-qty" aria-hidden />
            {t.chart.qty}
          </span>
          <span>{t.chart.hint}</span>
        </div>
      </div>
      <div className="grid grid-cols-[52px_minmax(0,1fr)_52px] gap-x-2.5 gap-y-2 md:grid-cols-[64px_minmax(0,1fr)_64px]" role="figure" aria-label={t.chart.aria}>
        <div className="relative h-[260px]" aria-hidden>
          {ticks.map((y, k) => (
            <span key={y} className="absolute right-0 translate-y-1/2 text-[12px] font-medium whitespace-nowrap text-imp-rev" style={{ bottom: `${y}%` }}>
              {compact((mxV * k) / 4)}
            </span>
          ))}
        </div>
        <div className="relative h-[260px] border-b border-line" onMouseLeave={() => setHover(null)}>
          {ticks.map((y) => (
            <div key={y} className="absolute inset-x-0 border-t border-dashed border-line-2" style={{ bottom: `${y}%` }} aria-hidden />
          ))}
          <div className="absolute inset-0 flex items-end gap-1">
            {slots.map((s, i) => {
              const on = filter.months.includes(s.month);
              const active = on || filter.months.length === 0;
              return (
                <button
                  key={`${s.year}-${s.month}`}
                  type="button"
                  title={tip(i)}
                  aria-label={tip(i)}
                  aria-pressed={on}
                  onClick={() => toggleMonth(s.month)}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  className={cn("flex h-full min-w-0 flex-1 items-end justify-center rounded-t-[3px] hover:bg-head", on && "bg-accent-tint")}
                >
                  <span
                    className={cn("w-[62%] rounded-t-[3px]", active ? "bg-imp-rev" : "bg-imp-rev/25")}
                    style={{ height: `${(s.rev / mxV) * 100}%` }}
                  />
                </button>
              );
            })}
          </div>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
            <polyline
              points={slots.map((s, i) => `${x(i).toFixed(2)},${(100 - (s.qty / mxQ) * 100).toFixed(2)}`).join(" ")}
              fill="none"
              stroke="var(--color-imp-qty)"
              strokeWidth={2.5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {slots.map((s, i) => (
            <span
              key={`d${i}`}
              className="pointer-events-none absolute -mb-1 -ml-1 size-2 rounded-full border-2 border-imp-qty bg-panel"
              style={{ left: `${x(i)}%`, bottom: `${(s.qty / mxQ) * 100}%` }}
              aria-hidden
            />
          ))}
          {hover !== null && slots[hover] && (
            <div
              className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-[6px] border border-line bg-head px-2.5 py-1.5 text-[12.5px] whitespace-nowrap text-fg shadow-pop"
              style={{ left: `${Math.min(85, Math.max(15, x(hover)))}%` }}
            >
              {tip(hover)}
            </div>
          )}
        </div>
        <div className="relative h-[260px]" aria-hidden>
          {ticks.map((y, k) => (
            <span key={y} className="absolute left-0 translate-y-1/2 text-[12px] font-medium whitespace-nowrap text-imp-qty" style={{ bottom: `${y}%` }}>
              {compact((mxQ * k) / 4)}
            </span>
          ))}
        </div>
        <div />
        <div className="flex gap-1" aria-hidden>
          {slots.map((s, i) => (
            <div key={`l${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
              <span className="text-[13px] font-medium text-fg-2 max-md:text-[11px]">{t.monthChip(s.month)}</span>
              <span className="text-[11px] font-medium whitespace-nowrap text-faint">{(multiYear ? s.month === 1 || i === 0 : i === 0) ? s.year : ""}</span>
            </div>
          ))}
        </div>
        <div />
      </div>
    </section>
  );
}

// --- Pivot tabs ---

function Pivots({
  data,
  piv,
  sheet,
  setSheet,
  tf,
  setTf,
  collapsed,
  setCollapsed,
  open,
  setOpen,
}: {
  data: ImportData;
  piv: PivotSheet[];
  sheet: Sheet;
  setSheet: (s: Sheet) => void;
  tf: TableFilters;
  setTf: (f: TableFilters) => void;
  collapsed: Record<string, number[]>;
  setCollapsed: (c: Record<string, number[]>) => void;
  open: string | null;
  setOpen: (id: string | null) => void;
}) {
  const t = useT(importsMessages);
  const opts = useMemo(() => options(data), [data]);
  const brandOpts = opts.brands.map((b) => ({ v: b, l: b }));
  const hzOpts = opts.hz.map((h) => ({ v: h, l: hzLabel(h) }));
  const monthOpts = Array.from({ length: 12 }, (_, i) => ({ v: i + 1, l: `${t.month} ${i + 1}` }));
  const yearOpts = YEARS.map((y) => ({ v: y, l: String(y) }));
  const ge = (n: number) => opts.hz.filter((h) => h >= n);
  const hzPresets: [string, number[] | null][] = [
    ["≥120Hz", ge(120)],
    ["≥144Hz", ge(144)],
    ["≥165Hz", ge(165)],
    [t.pop.all, null],
  ];
  const yearPresets: [string, Year[] | null][] = [["2024", [2024]], ["2025", [2025]], ["2026", [2026]], [t.pop.all, null]];
  const monthPresets: [string, number[] | null][] = [
    ["Q1", [1, 2, 3]],
    ["Q2", [4, 5, 6]],
    ["Q3", [7, 8, 9]],
    ["Q4", [10, 11, 12]],
    [`${t.monthChip(1)}–${t.monthChip(9)}`, [1, 2, 3, 4, 5, 6, 7, 8, 9]],
    [t.pop.wholeYear, null],
  ];

  type Ctrl = { id: string; node: React.ReactNode };
  const ctrl = <T extends string | number>(
    id: string,
    label: string,
    list: { v: T; l: string }[],
    sel: MultiSel<T>,
    onChange: (v: MultiSel<T>) => void,
    presets: [string, T[] | null][] = [],
    searchable = false,
  ): Ctrl => ({
    id,
    node: (
      <MultiSelect
        key={id}
        label={label}
        list={list}
        sel={sel}
        onChange={onChange}
        presets={presets}
        searchable={searchable}
        open={open === id}
        setOpen={(v) => setOpen(v ? id : null)}
      />
    ),
  });
  const g = (key: "g1" | "g2" | "g3", part: Partial<GamingFilter>) => setTf({ ...tf, [key]: { ...tf[key], ...part } });

  let tables: { table: PivotTable; title: string; ctrls: Ctrl[] }[];
  if (sheet === "Market TAM") {
    tables = [
      {
        table: tamTable(data, tf.tam),
        title: t.titles["Market TAM"][0],
        ctrls: [
          ctrl("tam.brand", t.brand, brandOpts, tf.tam.brand, (v) => setTf({ ...tf, tam: { ...tf.tam, brand: v } }), [], true),
          ctrl("tam.months", t.time, monthOpts, tf.tam.months, (v) => setTf({ ...tf, tam: { ...tf.tam, months: v } }), monthPresets),
        ],
      },
    ];
  } else if (sheet === "Gaming Only") {
    const titles = t.titles["Gaming Only"];
    const hzC = (key: "g1" | "g2" | "g3") => ctrl(`${key}.hz`, t.hzLong, hzOpts, tf[key].hz, (v) => g(key, { hz: v }), hzPresets);
    const brandC = (key: "g1" | "g2" | "g3") => ctrl(`${key}.brand`, t.brand, brandOpts, tf[key].brand, (v) => g(key, { brand: v }), [], true);
    const yearC = (key: "g1" | "g2" | "g3") => ctrl(`${key}.year`, t.year, yearOpts, tf[key].year, (v) => g(key, { year: v }), yearPresets);
    tables = [
      { table: gamingTable(data, "res", tf.g1), title: titles[0], ctrls: [hzC("g1"), brandC("g1"), yearC("g1")] },
      { table: gamingTable(data, "hz", tf.g2), title: titles[1], ctrls: [brandC("g2"), hzC("g2"), yearC("g2")] },
      { table: gamingTable(data, "panel", tf.g3), title: titles[2], ctrls: [hzC("g3"), brandC("g3"), yearC("g3")] },
    ];
  } else {
    const s = piv.find((x) => x.sheet === sheet) ?? piv[0];
    tables = s.tables.map((table, ti) => ({ table, title: t.titles[s.sheet]?.[ti] ?? table.name ?? "", ctrls: [] }));
  }

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line">
        <div role="tablist" aria-label={t.tabsLabel} className="flex flex-wrap gap-1">
          {SHEETS.map((n) => (
            <button
              key={n}
              type="button"
              role="tab"
              aria-selected={n === sheet}
              onClick={() => setSheet(n)}
              className={cn(
                "-mb-px border-b-2 px-4 py-3 text-[16px] font-semibold tracking-[0.04em] transition-colors",
                n === sheet ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="pb-2 text-[14px] text-muted">{t.tableCount(tables.length)}</span>
      </div>
      <div className="flex flex-wrap items-start gap-3">
        {tables.map(({ table, title, ctrls }, ti) => {
          const key = `${sheet}${ti}`;
          return (
            <PivotCard
              key={key}
              table={table}
              title={title}
              ctrls={ctrls.map((c) => c.node)}
              collapsed={new Set(collapsed[key] ?? [])}
              setCollapsed={(rows) => setCollapsed({ ...collapsed, [key]: [...rows] })}
            />
          );
        })}
      </div>
    </section>
  );
}

function PivotCard({
  table,
  title,
  ctrls,
  collapsed,
  setCollapsed,
}: {
  table: PivotTable;
  title: string;
  ctrls: React.ReactNode[];
  collapsed: Set<number>;
  setCollapsed: (rows: Set<number>) => void;
}) {
  const t = useT(importsMessages);
  const { num } = useNumbers();
  const nc = table.cols.length;
  const leaf = Math.max(0, ...table.rows.map((r) => r.l));
  const mx = heatMax(table);
  const parents = table.rows.flatMap((_, ri) => (hasKids(table, ri) ? [ri] : []));
  const anyCollapsed = parents.some((ri) => collapsed.has(ri));
  const wide = nc >= 9 || table.rows.length > 40;
  const toggle = (ri: number) => {
    const next = new Set(collapsed);
    if (!next.delete(ri)) next.add(ri);
    setCollapsed(next);
  };
  const fieldValue = (v: string) => (v === "(All)" ? t.fieldAll : v === "(Multiple Items)" ? t.fieldMulti : v);

  return (
    <div className={cn("flex max-w-full min-w-0 flex-col gap-3 rounded-[10px] border border-line bg-panel px-5 py-4.5", wide ? "basis-full" : "min-w-[min(460px,100%)] flex-[1_1_460px]")}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2.5">
          <h3 className="font-aldrich text-[19px] tracking-[0.04em] text-fg">{title}</h3>
          <span className="text-[13px] text-faint">
            {table.ref} · {table.measure ? headLabel(table.measure, t.head) : t.bothMeasures}
          </span>
        </div>
        {(ctrls.length > 0 || table.filters.length > 0 || parents.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {ctrls}
            {table.filters.map(([k, v]) => (
              <span key={k} className="flex h-6 items-center gap-1.5 rounded-chip border border-line bg-app px-2 text-[13px]">
                <span className="text-muted">{t.fields[k] ?? k}</span>
                <span className="text-fg">{fieldValue(v)}</span>
              </span>
            ))}
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
        )}
      </div>
      <div className="overflow-auto rounded-[6px] border border-line" style={{ maxHeight: table.rows.length > 40 ? 640 : undefined }}>
        <table className="w-full border-separate border-spacing-0 text-[14px] tabular-nums">
          <thead className="sticky top-0 z-[2]">
            {table.groups && (
              <tr>
                <th className="sticky left-0 z-[3] border-b border-line bg-head" />
                {table.groups.map((gr, i) => (
                  <th key={i} colSpan={gr.span} className="border-b border-l border-line bg-head px-2.5 py-2 text-center text-[15px] font-semibold tracking-[0.06em] text-fg">
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
                    "border-b border-line bg-head px-2.5 py-2 text-[13px] whitespace-nowrap",
                    i === 0 ? "sticky left-0 z-[3] text-left" : "text-right",
                    c === HIGHLIGHT ? "font-semibold text-key" : "font-medium text-muted",
                  )}
                >
                  {i === 0 ? table.rowFields.map((f) => t.fields[f] ?? f).join(" / ") : headLabel(c, t.head)}
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
                            "sticky left-0 z-[1] border-b border-line-2 py-1.5 pr-2.5 text-left whitespace-nowrap",
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
                        {isNum ? num(v as number) : v === "" ? "" : String(v)}
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

