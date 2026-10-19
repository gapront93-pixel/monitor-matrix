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
