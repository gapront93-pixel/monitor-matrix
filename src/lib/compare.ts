// Rows of the side-by-side comparison and the "best value" rule. Pure (tested in compare.test.ts).
import { fmtNum, resPx } from "./format";

export type Comparable = {
  thumb?: string | null;
  slug: string;
  brand: string;
  model: string;
  isGigabyte: boolean;
  sizeIn: number | null;
  panel: string | null;
  resolution: string | null;
  refreshHz: number | null;
  responseMs: number | null;
  brightnessSdrNits: number | null;
  brightnessHdrPeakNits: number | null;
  dciP3Pct: number | null;
  hdr: string | null;
  dpVer: string | null;
  hdmiVer: string | null;
  usbC: boolean | null;
  usbCPdW: number | null;
  heightAdjMm: number | null;
  pivot: boolean | null;
  kvm: boolean | null;
  minPrice: number | null;
  inStock: number;
  sellers: number;
};

export type Better = "high" | "low";

/** Words the table needs, from catalogMessages.words */
export type Words = { yes: string; no: string; noPrice: string };

export type FieldKey = "price" | "stock" | "size" | "panel" | "res" | "hz" | "ms" | "sdr" | "hdrp" | "p3" | "hdr" | "dp" | "hdmi" | "pd" | "height" | "pivot" | "kvm";

export type CompareField = {
  key: FieldKey; // also the label key in catalogMessages.fields
  /** Number used to rank (null = no data); omitted for text-only rows */
  rank?: (p: Comparable) => number | null;
  better?: Better;
  show: (p: Comparable, w: Words) => string;
};

const yn = (v: boolean | null, w: Words) => (v === null ? "—" : v ? w.yes : w.no);
const num = (v: number | null, unit = "") => (v === null ? "—" : `${fmtNum(v)}${unit}`);

export const COMPARE_FIELDS: CompareField[] = [
  { key: "price", rank: (p) => p.minPrice, better: "low", show: (p, w) => (p.minPrice ? fmtNum(p.minPrice) : w.noPrice) },
  { key: "stock", rank: (p) => (p.sellers ? p.inStock : null), better: "high", show: (p) => (p.sellers ? String(p.inStock) : "—") },
  { key: "size", show: (p) => (p.sizeIn !== null ? `${p.sizeIn}"` : "—") },
  { key: "panel", show: (p) => p.panel ?? "—" },
  { key: "res", show: (p) => resPx(p.resolution) || "—" },
  { key: "hz", rank: (p) => p.refreshHz, better: "high", show: (p) => num(p.refreshHz, " Hz") },
  { key: "ms", rank: (p) => p.responseMs, better: "low", show: (p) => num(p.responseMs, " ms") },
  { key: "sdr", rank: (p) => p.brightnessSdrNits, better: "high", show: (p) => num(p.brightnessSdrNits, " nit") },
  { key: "hdrp", rank: (p) => p.brightnessHdrPeakNits, better: "high", show: (p) => num(p.brightnessHdrPeakNits, " nit") },
  { key: "p3", rank: (p) => p.dciP3Pct, better: "high", show: (p) => num(p.dciP3Pct, "%") },
  { key: "hdr", show: (p) => p.hdr ?? "—" },
  { key: "dp", show: (p) => p.dpVer ?? "—" },
  { key: "hdmi", show: (p) => p.hdmiVer ?? "—" },
  {
    key: "pd",
    rank: (p) => (p.usbC === false ? 0 : p.usbCPdW),
    better: "high",
    show: (p, w) => (p.usbC === false ? w.no : p.usbCPdW !== null ? `${fmtNum(p.usbCPdW)}W` : p.usbC ? w.yes : "—"),
  },
  { key: "height", rank: (p) => p.heightAdjMm, better: "high", show: (p) => num(p.heightAdjMm, " mm") },
  { key: "pivot", show: (p, w) => yn(p.pivot, w) },
  { key: "kvm", show: (p, w) => yn(p.kvm, w) },
];

/**
 * Indexes holding the best value of a row. Nothing is marked when fewer than two items have data
 * or when every item with data has the same value.
 */
export function bestIndexes(values: (number | null)[], better: Better): Set<number> {
  const known = values.map((v, i) => [v, i] as const).filter((x): x is readonly [number, number] => x[0] !== null);
  if (known.length < 2) return new Set();
  const nums = known.map(([v]) => v);
  if (nums.every((v) => v === nums[0])) return new Set();
  const target = better === "high" ? Math.max(...nums) : Math.min(...nums);
  return new Set(known.filter(([v]) => v === target).map(([, i]) => i));
}

/** For "Chỉ hiện điểm khác nhau": the row shows the same text for everyone */
export function rowIsSame(field: CompareField, items: Comparable[], w: Words): boolean {
  const texts = items.map((p) => field.show(p, w));
  return texts.every((t) => t === texts[0]);
}
