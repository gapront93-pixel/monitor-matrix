import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ALL_FILTER, EMPTY_FILTER, PRESETS, buildPivot, chartSlots, yearSeries, gamingTable, hzBucket, niceMax, options, sizeBucket, tamTable, visibleRows, type ImportData, type PivotSheet } from "./imports";

const dir = path.join(__dirname, "..", "..", "data", "import");
const data: ImportData = JSON.parse(readFileSync(path.join(dir, "import-raw-2024-2026.json"), "utf8"));
const piv: PivotSheet[] = JSON.parse(readFileSync(path.join(dir, "pivots-static.json"), "utf8"));
const ge = (n: number) => options(data).hz.filter((h) => h >= n);
const rowOf = (rows: { c: (string | number)[] }[], label: string) => rows.find((r) => r.c[0] === label)?.c;

describe("import buckets and axis", () => {
  it("buckets sizes and refresh rates like the design", () => {
    expect([22, 23.8, 24.5, 25, 27, 27.5, 31.5, 34, 49].map(sizeBucket)).toEqual([0, 1, 1, 2, 3, 3, 4, 5, 5]);
    expect([60, 75, 100, 144, 165, 180, 240, 260].map(hzBucket)).toEqual([0, 0, 1, 2, 2, 3, 3, 4]);
    expect([0, 0.8, 1.7, 2.2, 3, 7, 12_345].map(niceMax)).toEqual([1, 1, 2, 2.5, 5, 10, 20_000]);
  });
});

describe("chart", () => {
  it("has 12 months for full years and stops 2026 at September", () => {
    expect(chartSlots(data, { ...EMPTY_FILTER, years: [2025, 2026] }).map((s) => `${s.year}-${s.month}`)).toHaveLength(21);
  });
  it("adds up to the yearly totals; month chips only dim bars", () => {
    const all = chartSlots(data, EMPTY_FILTER).reduce((n, s) => n + s.qty, 0);
    expect(all).toBe(data.r2026.reduce((n, r) => n + r[11], 0));
    expect(chartSlots(data, { ...EMPTY_FILTER, months: [3] })).toHaveLength(9);
  });
});

describe("pivot tables match the workbook", () => {
  // The workbook's own pivots use a hand-picked "Multiple Items" Hz list, so the computed tables are checked
  // against the rows directly (and against the design file in the browser)
  it("Gaming Only size × resolution (2026, ≥144Hz) adds up the matching rows", () => {
    const hz = new Set(ge(144));
    const mine = gamingTable(data, "res", { hz: [...hz], brand: null, year: [2026] });
    const rows24 = data.r2026.filter((r) => r[5] === 24 && hz.has(r[9]));
    expect(rowOf(mine.rows, "24 inch")!.at(-1)).toBe(rows24.reduce((n, r) => n + r[11], 0));
    const order = ["HD", "FullHD", "WUXGA", "QHD", "UHD", "5K", "6K"];
    const idx = mine.cols.slice(1, -1).map((c) => order.indexOf(c));
    expect(idx).toEqual([...idx].sort((x, y) => x - y));
    const grand = mine.rows.at(-1)!.c;
    expect(grand.at(-1)).toBe(data.r2026.filter((r) => hz.has(r[9])).reduce((n, r) => n + r[11], 0));
  });
  it("Market TAM rows add up across years", () => {
    const t = tamTable(data, { brand: null, months: null });
    const total = t.rows.at(-1)!.c;
    expect(total[7]).toBe((total[1] as number) + (total[3] as number) + (total[5] as number));
  });
  it("collapsing a parent hides its children only", () => {
    const t = piv.find((s) => s.sheet === "Analysis UTD")!.tables[0];
    expect(visibleRows(t, new Set([0])).length).toBeLessThan(t.rows.length);
    expect(visibleRows(t, new Set()).length).toBe(t.rows.length);
  });
});

const W = { month: (m: number) => `T${m}`, quarter: (q: number) => `Q${q}`, other: "Khác" };

describe("pivot builder", () => {
  it("Market TAM preset gives the same cells as the Market TAM table", () => {
    const p = PRESETS[0];
    const mine = buildPivot(data, { ...ALL_FILTER, ...p.filter }, p.spec, W);
    const tam = tamTable(data, { brand: null, months: null });
    expect(mine.rows.map((r) => r.c.slice(1))).toEqual(tam.rows.map((r) => r.c.slice(1)));
  });
  it("Gaming Only preset matches the Gaming Only table", () => {
    const p = PRESETS[1];
    const mine = buildPivot(data, { ...ALL_FILTER, ...p.filter, hz: ge(144) }, p.spec, W);
    const old = gamingTable(data, "res", { hz: ge(144), brand: null, year: [2026] });
    expect(mine.rows.map((r) => r.c)).toEqual(old.rows.map((r) => r.c));
  });
  it("sub-rows add up to their parent and wide column sets fold into 'other'", () => {
    const t = buildPivot(data, { ...ALL_FILTER, years: [2026] }, { row: "size", sub: "res", col: "brand", measure: "qty" }, W);
    expect(t.cols.length).toBeLessThanOrEqual(42);
    const i = t.rows.findIndex((r) => r.c[0] === "24 inch");
    const kids = [];
    for (let j = i + 1; t.rows[j]?.l === 1; j++) kids.push(t.rows[j]);
    expect(kids.reduce((n, r) => n + Number(r.c.at(-1)), 0)).toBe(t.rows[i].c.at(-1));
  });
  it("year series has 12 months and no 2026 value after September", () => {
    const s = yearSeries(data, { ...EMPTY_FILTER, years: [2025, 2026] });
    expect(s).toHaveLength(12);
    expect(s[9].byYear[2026]).toBeNull();
    expect(s[0].byYear[2025]!.qty).toBeGreaterThan(0);
  });
});
