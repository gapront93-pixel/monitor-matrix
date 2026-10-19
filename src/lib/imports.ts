// Monitor imports into Vietnam (customs RAW 2024–2026, from "LCD IMPORT DATA - Analysis 2026.xlsx").
// Pure: filters, the monthly chart and the pivot tables computed from the rows (tested in imports.test.ts).
// The rules follow the approved design file LCD-Import-2026-preview.html, so the same filters give the same numbers.

export const YEARS = [2024, 2025, 2026] as const;
export type Year = (typeof YEARS)[number];

// Columns of a row: m, d, imp, model, brand, size, type, panel, res, hz, fob, qty, rev, country, port, dk
export type ImportRow = [number, number, number, number, number, number, string, string, string, number, number, number, number, number, number, number];
export const C = { m: 0, d: 1, imp: 2, model: 3, brand: 4, size: 5, type: 6, panel: 7, res: 8, hz: 9, fob: 10, qty: 11, rev: 12 } as const;

export type ImportData = {
  meta: { latest: number }; // MDD of the newest row: 922 = 22/09
  dicts: { imp: string[]; model: string[]; brand: string[]; country: string[]; port: string[]; dk: string[] };
  r2024: ImportRow[];
  r2025: ImportRow[];
  r2026: ImportRow[];
};

export const rowsOf = (d: ImportData, y: Year): ImportRow[] => d[`r${y}`];

/** Months with data in a year (2026 stops at the latest month) */
export function monthsIn(d: ImportData, y: Year): number {
  return y === 2026 ? Math.floor(d.meta.latest / 100) : 12;
}

// --- Chart filters (bucket labels are messages; these are the bucket rules) ---
export const SIZE_BUCKETS = 6; // ≤22", 23–24", 25–26", 27", 28–32", ≥34"
export const HZ_BUCKETS = 5; // ≤75, 100, 120–165, 170–240, >240Hz
export const sizeBucket = (s: number) => (s <= 22 ? 0 : s <= 24.5 ? 1 : s < 27 ? 2 : s < 28 ? 3 : s < 34 ? 4 : 5);
export const hzBucket = (h: number) => (h <= 75 ? 0 : h <= 100 ? 1 : h <= 165 ? 2 : h <= 240 ? 3 : 4);

export type ChartFilter = {
  years: Year[];
  months: number[]; // empty = all
  brand: string;
  panel: string;
  res: string;
  hz: number | null; // bucket
  size: number | null; // bucket
  search: string;
};

export const EMPTY_FILTER: ChartFilter = { years: [2026], months: [], brand: "", panel: "", res: "", hz: null, size: null, search: "" };

export function filterCount(f: ChartFilter): number {
  return [f.months.length > 0, f.brand, f.panel, f.res, f.hz !== null, f.size !== null, f.search.trim()].filter(Boolean).length;
}

export function rowFilter(d: ImportData, f: ChartFilter): (r: ImportRow) => boolean {
  const B = d.dicts.brand, M = d.dicts.model, I = d.dicts.imp;
  const q = f.search.trim().toUpperCase();
  return (r) =>
    (!f.brand || B[r[C.brand]] === f.brand) &&
    (!f.panel || r[C.panel] === f.panel) &&
    (!f.res || r[C.res] === f.res) &&
    (f.hz === null || hzBucket(r[C.hz]) === f.hz) &&
    (f.size === null || sizeBucket(r[C.size]) === f.size) &&
    (!q || M[r[C.model]].toUpperCase().includes(q) || I[r[C.imp]].toUpperCase().includes(q));
}

export type Slot = { year: Year; month: number; qty: number; rev: number };

/** One slot per month of each chosen year, in order (the month chips only dim bars, they do not remove them) */
export function chartSlots(d: ImportData, f: ChartFilter): Slot[] {
  const pass = rowFilter(d, f);
  const out: Slot[] = [];
  for (const y of YEARS.filter((x) => f.years.includes(x))) {
    const qty = Array(12).fill(0), rev = Array(12).fill(0);
    for (const r of rowsOf(d, y)) {
      if (!pass(r)) continue;
      qty[r[C.m] - 1] += r[C.qty];
      rev[r[C.m] - 1] += r[C.rev];
    }
    for (let i = 0; i < monthsIn(d, y); i++) out.push({ year: y, month: i + 1, qty: qty[i], rev: rev[i] });
  }
  return out;
}

/** Axis top rounded up to 1 / 2 / 2.5 / 5 / 10 × 10ⁿ */
export function niceMax(x: number): number {
  if (x <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

// --- Filter options ---
export type Opt<T = string | number> = { v: T; l: string };

export function options(d: ImportData) {
  const all = [...d.r2024, ...d.r2025, ...d.r2026];
  const byBrand = new Map<number, number>();
  for (const r of all) byBrand.set(r[C.brand], (byBrand.get(r[C.brand]) ?? 0) + r[C.qty]);
  const B = d.dicts.brand;
  const uniq = <T,>(xs: T[]) => [...new Set(xs)];
  return {
    // Popovers: every brand of 2024–2026, most units first; Hz values ascending
    brands: [...byBrand.entries()].sort((a, b) => b[1] - a[1]).map(([i]) => B[i]),
    hz: uniq(all.map((r) => r[C.hz])).sort((a, b) => a - b),
    // Chart dropdowns list what 2026 has
    brands2026: uniq(d.r2026.map((r) => B[r[C.brand]])).sort(),
    panels2026: uniq(d.r2026.map((r) => r[C.panel])).sort(),
    res2026: uniq(d.r2026.map((r) => r[C.res])).sort(),
  };
}

// --- Pivot tables ---
export type Cell = number | string; // "" = no data
export type PivotRow = { l: number; c: Cell[] }; // l: level (0, 1…), -1 = grand total
export type PivotTable = {
  key: string;
  title?: string; // computed tables; static ones get their title from the sheet
  name?: string;
  ref: string;
  measure: string; // "Tổng của QTY" or ""
  filters: [string, string][]; // read-only, from the file
  rowFields: string[];
  cols: string[];
  groups: { label: string; span: number }[] | null;
  rows: PivotRow[];
};
export type PivotSheet = { sheet: string; tables: PivotTable[] };

// null = all values
export type MultiSel<T> = T[] | null;
const inSel = <T,>(sel: MultiSel<T>, v: T) => sel === null || sel.includes(v);

const sizeLabel = (s: number) => (s ? `${s} inch` : "N/A");
const RES_ORDER = ["HD", "FULLHD", "WUXGA", "QHD", "UHD", "5K", "6K"];
export const resLabel = (v: string) => (v === "FULLHD" ? "FullHD" : v);
export const hzLabel = (h: number) => (h ? `${h}Hz` : "N/A");

/** Market TAM: size × year, units and revenue, with totals */
export function tamTable(d: ImportData, f: { brand: MultiSel<string>; months: MultiSel<number> }): PivotTable {
  const B = d.dicts.brand;
  const m = new Map<number, number[]>();
  YEARS.forEach((y, yi) => {
    for (const r of rowsOf(d, y)) {
      if (!inSel(f.brand, B[r[C.brand]]) || !inSel(f.months, r[C.m])) continue;
      let o = m.get(r[C.size]);
      if (!o) m.set(r[C.size], (o = Array(8).fill(0)));
      o[yi * 2] += r[C.qty];
      o[yi * 2 + 1] += r[C.rev];
      o[6] += r[C.qty];
      o[7] += r[C.rev];
    }
  });
  const keys = [...m.keys()].sort((a, b) => a - b);
  const tot = Array(8).fill(0);
  for (const k of keys) m.get(k)!.forEach((v, i) => (tot[i] += v));
  const z = (v: number): Cell => v || "";
  return {
    key: "tam",
    ref: "RAW 2024–2026",
    measure: "",
    filters: [],
    rowFields: ["Size"],
    cols: ["Size", "Tổng của QTY", "Tổng của REV", "Tổng của QTY", "Tổng của REV", "Tổng của QTY", "Tổng của REV", "Total Tổng của QTY", "Total Tổng của REV"],
    groups: [
      { label: "2024", span: 2 },
      { label: "2025", span: 2 },
      { label: "2026", span: 2 },
      { label: "", span: 1 },
      { label: "", span: 1 },
    ],
    rows: [...keys.map((k) => ({ l: 0, c: [sizeLabel(k), ...m.get(k)!.map(z)] })), { l: -1, c: ["Grand Total", ...tot.map(z)] }],
  };
}

export type GamingFilter = { hz: MultiSel<number>; brand: MultiSel<string>; year: MultiSel<Year> };
export type GamingKind = "res" | "hz" | "panel";

/** Gaming Only: size × resolution / refresh rate / panel, units */
export function gamingTable(d: ImportData, kind: GamingKind, f: GamingFilter): PivotTable {
  const B = d.dicts.brand;
  const colOf = (r: ImportRow): string | number => (kind === "res" ? r[C.res] : kind === "hz" ? r[C.hz] : r[C.panel]);
  const m = new Map<number, Map<string | number, number>>();
  const cs = new Set<string | number>();
  const years = f.year === null ? [...YEARS] : YEARS.filter((y) => f.year!.includes(y));
  for (const y of years) {
    for (const r of rowsOf(d, y)) {
      if (!inSel(f.brand, B[r[C.brand]]) || !inSel(f.hz, r[C.hz])) continue;
      const c = colOf(r);
      cs.add(c);
      let o = m.get(r[C.size]);
      if (!o) m.set(r[C.size], (o = new Map()));
      o.set(c, (o.get(c) ?? 0) + r[C.qty]);
    }
  }
  const colTotal = (x: string | number) => [...m.values()].reduce((s, o) => s + (o.get(x) ?? 0), 0);
  const cols = [...cs].sort(
    kind === "res"
      ? (a, b) => RES_ORDER.indexOf(String(a)) - RES_ORDER.indexOf(String(b))
      : kind === "hz"
        ? (a, b) => Number(a) - Number(b)
        : (a, b) => colTotal(b) - colTotal(a),
  );
  const keys = [...m.keys()].sort((a, b) => a - b);
  const rows: PivotRow[] = keys.map((k) => {
    const o = m.get(k)!;
    let t = 0;
    const c = cols.map((x) => {
      const v = o.get(x) ?? 0;
      t += v;
      return v || "";
    });
    return { l: 0, c: [sizeLabel(k), ...c, t] };
  });
  const gt = cols.map(colTotal);
  const label = (x: string | number) => (kind === "res" ? resLabel(String(x)) : kind === "hz" ? hzLabel(Number(x)) : String(x));
  return {
    key: `g-${kind}`,
    ref: `RAW ${f.year === null ? "2024–2026" : years.join(", ")}`,
    measure: "Tổng của QTY",
    filters: [],
    rowFields: ["Size"],
    cols: ["Size", ...cols.map(label), "Grand Total"],
    groups: null,
    rows: [...rows, { l: -1, c: ["Grand Total", ...gt, gt.reduce((a, b) => a + b, 0)] }],
  };
}

/** Header cells of the Excel pivots, renamed (labels come from the page messages) */
export type HeadWords = { qty: string; rev: string; qtyTotal: string; revTotal: string; total: string };
export function headLabel(v: string, w: HeadWords): string {
  const t = /Total/i.test(v);
  if (/QTY/.test(v)) return t ? w.qtyTotal : w.qty;
  if (/REV/.test(v)) return t ? w.revTotal : w.rev;
  if (/^Grand Total$/i.test(v.trim())) return w.total;
  return v;
}

export const isTotalCol = (t: PivotTable, i: number) => /Total/i.test(t.cols[i] ?? "");
export const isRevCol = (t: PivotTable, i: number) => /REV/.test(t.cols[i] ?? "");

/** Heatmap maxima per measure, from leaf rows and non-total columns only */
export function heatMax(t: PivotTable): { q: number; r: number } {
  const leaf = Math.max(0, ...t.rows.map((r) => r.l));
  const mx = { q: 0, r: 0 };
  for (const row of t.rows) {
    if (row.l !== leaf) continue;
    row.c.forEach((v, i) => {
      if (i && typeof v === "number" && !isTotalCol(t, i)) {
        const g = isRevCol(t, i) ? "r" : "q";
        mx[g] = Math.max(mx[g], v);
      }
    });
  }
  return mx;
}

export const hasKids = (t: PivotTable, ri: number) => !!t.rows[ri + 1] && t.rows[ri + 1].l > t.rows[ri].l;

/** Rows to show, given the collapsed parent rows (keys are row indexes) */
export function visibleRows(t: PivotTable, collapsed: Set<number>): number[] {
  const out: number[] = [];
  let hide = false;
  t.rows.forEach((r, ri) => {
    if (r.l === 0 || r.l === -1) hide = false;
    if (r.l > 0 && hide) return;
    if (r.l === 0 && collapsed.has(ri) && hasKids(t, ri)) hide = true;
    out.push(ri);
  });
  return out;
}

// --- Pivot builder: any dimension on rows (with an optional sub-row) and columns, over the RAW rows ---

export const DIMS = ["year", "quarter", "month", "size", "brand", "res", "panel", "hz", "model"] as const;
export type Dim = (typeof DIMS)[number];
export type Measure = "qty" | "rev" | "both";

export type PivotFilter = {
  years: MultiSel<Year>;
  months: MultiSel<number>;
  sizes: MultiSel<number>;
  brands: MultiSel<string>;
  res: MultiSel<string>;
  panels: MultiSel<string>;
  hz: MultiSel<number>;
};
export const ALL_FILTER: PivotFilter = { years: null, months: null, sizes: null, brands: null, res: null, panels: null, hz: null };

export type PivotSpec = { row: Dim; sub: Dim | null; col: Dim | null; measure: Measure };

const MAX_COLS = 40; // wider than that, the smallest columns fold into one "other" column
export const OTHER_KEY = "\u0000other";

type Key = string | number;
function dimKey(d: ImportData, dim: Dim, r: ImportRow, y: Year): Key {
  switch (dim) {
    case "year":
      return y;
    case "quarter":
      return Math.ceil(r[C.m] / 3);
    case "month":
      return r[C.m];
    case "size":
      return r[C.size];
    case "brand":
      return d.dicts.brand[r[C.brand]];
    case "res":
      return r[C.res];
    case "panel":
      return r[C.panel];
    case "hz":
      return r[C.hz];
    case "model":
      return d.dicts.model[r[C.model]];
  }
}

export type DimWords = { month: (m: number) => string; quarter: (q: number) => string; other: string };
export function dimLabel(dim: Dim, k: Key, w: DimWords): string {
  if (k === OTHER_KEY) return w.other;
  switch (dim) {
    case "quarter":
      return w.quarter(Number(k));
    case "month":
      return w.month(Number(k));
    case "size":
      return sizeLabel(Number(k));
    case "res":
      return resLabel(String(k));
    case "hz":
      return hzLabel(Number(k));
    default:
      return String(k);
  }
}

/** Natural order for time, size, refresh rate and resolution; by total (largest first) for the others */
function orderKeys(dim: Dim, keys: Key[], total: (k: Key) => number): Key[] {
  if (dim === "year" || dim === "quarter" || dim === "month" || dim === "size" || dim === "hz") return [...keys].sort((a, b) => Number(a) - Number(b));
  if (dim === "res") return [...keys].sort((a, b) => (RES_ORDER.indexOf(String(a)) + 1 || 99) - (RES_ORDER.indexOf(String(b)) + 1 || 99));
  return [...keys].sort((a, b) => total(b) - total(a));
}

export function pivotFilterPass(d: ImportData, f: PivotFilter): (r: ImportRow, y: Year) => boolean {
  const B = d.dicts.brand;
  return (r, y) =>
    inSel(f.years, y) &&
    inSel(f.months, r[C.m]) &&
    inSel(f.sizes, r[C.size]) &&
    inSel(f.brands, B[r[C.brand]]) &&
    inSel(f.res, r[C.res]) &&
    inSel(f.panels, r[C.panel]) &&
    inSel(f.hz, r[C.hz]);
}

/** A pivot over the filtered rows, in the shape the pivot cards render (totals column and row, groups for "both") */
export function buildPivot(d: ImportData, f: PivotFilter, spec: PivotSpec, w: DimWords): PivotTable {
  const pass = pivotFilterPass(d, f);
  type Acc = { q: number; r: number };
  const add = (m: Map<Key, Acc>, k: Key, q: number, rv: number) => {
    const a = m.get(k) ?? { q: 0, r: 0 };
    a.q += q;
    a.r += rv;
    m.set(k, a);
  };
  // row -> (sub ->) col -> sums
  const cells = new Map<Key, { all: Map<Key, Acc>; sum: Acc; subs: Map<Key, { all: Map<Key, Acc>; sum: Acc }> }>();
  const colTot = new Map<Key, Acc>();
  const grand: Acc = { q: 0, r: 0 };
  const col = spec.col;
  for (const y of YEARS) {
    for (const r of rowsOf(d, y)) {
      if (!pass(r, y)) continue;
      const q = r[C.qty], rv = r[C.rev];
      const rk = dimKey(d, spec.row, r, y);
      const ck: Key = col ? dimKey(d, col, r, y) : "";
      let row = cells.get(rk);
      if (!row) cells.set(rk, (row = { all: new Map(), sum: { q: 0, r: 0 }, subs: new Map() }));
      add(row.all, ck, q, rv);
      row.sum.q += q;
      row.sum.r += rv;
      if (spec.sub) {
        const sk = dimKey(d, spec.sub, r, y);
        let s = row.subs.get(sk);
        if (!s) row.subs.set(sk, (s = { all: new Map(), sum: { q: 0, r: 0 } }));
        add(s.all, ck, q, rv);
        s.sum.q += q;
        s.sum.r += rv;
      }
      add(colTot, ck, q, rv);
      grand.q += q;
      grand.r += rv;
    }
  }
  const main = (a: Acc) => (spec.measure === "rev" ? a.r : a.q);
  let colKeys: Key[] = col ? orderKeys(col, [...colTot.keys()], (k) => main(colTot.get(k)!)) : [];
  // Too many columns: keep the largest, fold the rest
  let folded = new Set<Key>();
  if (col && colKeys.length > MAX_COLS) {
    const byTotal = [...colKeys].sort((a, b) => main(colTot.get(b)!) - main(colTot.get(a)!));
    folded = new Set(byTotal.slice(MAX_COLS - 1));
    colKeys = [...colKeys.filter((k) => !folded.has(k)), OTHER_KEY];
  }
  const get = (m: Map<Key, Acc>, k: Key): Acc => {
    if (k !== OTHER_KEY) return m.get(k) ?? { q: 0, r: 0 };
    const o = { q: 0, r: 0 };
    for (const [kk, a] of m) {
      if (!folded.has(kk)) continue;
      o.q += a.q;
      o.r += a.r;
    }
    return o;
  };
  const both = spec.measure === "both";
  const vals = (a: Acc): Cell[] => (both ? [a.q || "", a.r || ""] : [main(a) || ""]);
  const line = (all: Map<Key, Acc>, sum: Acc): Cell[] => [...(col ? colKeys.flatMap((k) => vals(get(all, k))) : []), ...vals(sum)];

  const rows: PivotRow[] = [];
  const rowKeys = orderKeys(spec.row, [...cells.keys()], (k) => main(cells.get(k)!.sum));
  for (const rk of rowKeys) {
    const row = cells.get(rk)!;
    rows.push({ l: 0, c: [dimLabel(spec.row, rk, w), ...line(row.all, row.sum)] });
    if (spec.sub) {
      for (const sk of orderKeys(spec.sub, [...row.subs.keys()], (k) => main(row.subs.get(k)!.sum))) {
        const s = row.subs.get(sk)!;
        rows.push({ l: 1, c: [dimLabel(spec.sub, sk, w), ...line(s.all, s.sum)] });
      }
    }
  }
  rows.push({ l: -1, c: ["Grand Total", ...line(colTot, grand)] });

  const measureCols = both ? ["Tổng của QTY", "Tổng của REV"] : [spec.measure === "rev" ? "Tổng của REV" : "Tổng của QTY"];
  const colLabels = col ? colKeys.map((k) => dimLabel(col, k, w)) : [];
  const cols = [
    spec.row,
    ...(both ? colLabels.flatMap(() => measureCols) : colLabels),
    ...(both ? measureCols.map((m) => `Total ${m}`) : col ? ["Grand Total"] : measureCols),
  ];
  return {
    key: `pv-${spec.row}-${spec.sub}-${spec.col}-${spec.measure}`,
    ref: "RAW 2024–2026",
    measure: both ? "" : measureCols[0],
    filters: [],
    rowFields: [spec.row, ...(spec.sub ? [spec.sub] : [])],
    cols,
    groups: both && col ? [...colLabels.map((label) => ({ label, span: 2 })), { label: "", span: 2 }] : null,
    rows,
  };
}

/** The analyses of the workbook's pivot sheets, as builder settings */
export const PRESETS: { sheet: string; spec: PivotSpec; filter: Partial<PivotFilter>; gaming?: number }[] = [
  { sheet: "Market TAM", spec: { row: "size", sub: null, col: "year", measure: "both" }, filter: {} },
  { sheet: "Gaming Only", spec: { row: "size", sub: null, col: "res", measure: "qty" }, filter: { years: [2026] }, gaming: 144 },
  { sheet: "Gaming Only", spec: { row: "size", sub: null, col: "hz", measure: "qty" }, filter: { years: [2026] }, gaming: 120 },
  { sheet: "Gaming Only", spec: { row: "size", sub: null, col: "panel", measure: "qty" }, filter: { years: [2026] }, gaming: 144 },
  { sheet: "Gaming by Brand", spec: { row: "brand", sub: null, col: "year", measure: "qty" }, filter: { years: [2025, 2026] }, gaming: 144 },
  { sheet: "Gaming by Brand", spec: { row: "res", sub: "size", col: "brand", measure: "qty" }, filter: { years: [2026] }, gaming: 144 },
  { sheet: "Analysis UTD", spec: { row: "size", sub: "res", col: "panel", measure: "qty" }, filter: { years: [2026] }, gaming: 144 },
  { sheet: "Analysis UTD", spec: { row: "size", sub: "res", col: "brand", measure: "qty" }, filter: { years: [2026] }, gaming: 144 },
  { sheet: "Analysis UTD", spec: { row: "brand", sub: null, col: "panel", measure: "qty" }, filter: { years: [2026] }, gaming: 144 },
  { sheet: "Analysis UTD", spec: { row: "brand", sub: "model", col: "panel", measure: "qty" }, filter: { years: [2026] }, gaming: 144 },
];

/** Year-on-year chart: one value per month and chosen year (months a year has no data for stay null) */
export function yearSeries(d: ImportData, f: ChartFilter): { month: number; byYear: Record<number, { qty: number; rev: number } | null> }[] {
  const pass = rowFilter(d, f);
  const years = YEARS.filter((y) => f.years.includes(y));
  const sums = new Map<Year, { qty: number[]; rev: number[] }>();
  for (const y of years) {
    const qty = Array(12).fill(0), rev = Array(12).fill(0);
    for (const r of rowsOf(d, y)) {
      if (!pass(r)) continue;
      qty[r[C.m] - 1] += r[C.qty];
      rev[r[C.m] - 1] += r[C.rev];
    }
    sums.set(y, { qty, rev });
  }
  const last = Math.max(...years.map((y) => monthsIn(d, y)));
  return Array.from({ length: last }, (_, i) => ({
    month: i + 1,
    byYear: Object.fromEntries(years.map((y) => [y, i < monthsIn(d, y) ? { qty: sums.get(y)!.qty[i], rev: sums.get(y)!.rev[i] } : null])),
  }));
}

/** Values of each dimension for the pivot filters */
export function dimOptions(d: ImportData) {
  const all = [...d.r2024, ...d.r2025, ...d.r2026];
  const uniq = <T,>(xs: T[]) => [...new Set(xs)];
  return {
    sizes: uniq(all.map((r) => r[C.size])).sort((a, b) => a - b),
    res: uniq(all.map((r) => r[C.res])).sort((a, b) => (RES_ORDER.indexOf(a) + 1 || 99) - (RES_ORDER.indexOf(b) + 1 || 99)),
    panels: uniq(all.map((r) => r[C.panel])).sort(),
  };
}
