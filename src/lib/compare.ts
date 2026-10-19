// Rows of the side-by-side comparison and the "best value" rule. Pure (tested in compare.test.ts).
import { fmtNum, resPx } from "./format";

export type Comparable = {
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

export type CompareField = {
  key: string;
  label: string;
  /** Number used to rank (null = no data); omitted for text-only rows */
  rank?: (p: Comparable) => number | null;
  better?: Better;
  show: (p: Comparable) => string;
};

const yn = (v: boolean | null) => (v === null ? "—" : v ? "Có" : "Không");
const num = (v: number | null, unit = "") => (v === null ? "—" : `${fmtNum(v)}${unit}`);

export const COMPARE_FIELDS: CompareField[] = [
  { key: "price", label: "Giá thấp nhất", rank: (p) => p.minPrice, better: "low", show: (p) => (p.minPrice ? fmtNum(p.minPrice) : "Chưa có giá") },
  { key: "stock", label: "Số nơi còn hàng", rank: (p) => (p.sellers ? p.inStock : null), better: "high", show: (p) => (p.sellers ? String(p.inStock) : "—") },
  { key: "size", label: "Kích thước", show: (p) => (p.sizeIn !== null ? `${p.sizeIn}"` : "—") },
  { key: "panel", label: "Tấm nền", show: (p) => p.panel ?? "—" },
  { key: "res", label: "Độ phân giải", show: (p) => resPx(p.resolution) || "—" },
  { key: "hz", label: "Tần số quét", rank: (p) => p.refreshHz, better: "high", show: (p) => num(p.refreshHz, " Hz") },
  { key: "ms", label: "Phản hồi (GtG)", rank: (p) => p.responseMs, better: "low", show: (p) => num(p.responseMs, " ms") },
  { key: "sdr", label: "Độ sáng SDR", rank: (p) => p.brightnessSdrNits, better: "high", show: (p) => num(p.brightnessSdrNits, " nit") },
  { key: "hdrp", label: "Độ sáng HDR peak", rank: (p) => p.brightnessHdrPeakNits, better: "high", show: (p) => num(p.brightnessHdrPeakNits, " nit") },
  { key: "p3", label: "Độ phủ DCI-P3", rank: (p) => p.dciP3Pct, better: "high", show: (p) => num(p.dciP3Pct, "%") },
  { key: "hdr", label: "Chuẩn HDR", show: (p) => p.hdr ?? "—" },
  { key: "dp", label: "DisplayPort", show: (p) => p.dpVer ?? "—" },
  { key: "hdmi", label: "HDMI", show: (p) => p.hdmiVer ?? "—" },
  {
    key: "pd",
    label: "USB-C PD",
    rank: (p) => (p.usbC === false ? 0 : p.usbCPdW),
    better: "high",
    show: (p) => (p.usbC === false ? "Không" : p.usbCPdW !== null ? `${fmtNum(p.usbCPdW)}W` : p.usbC ? "Có" : "—"),
  },
  { key: "height", label: "Nâng hạ", rank: (p) => p.heightAdjMm, better: "high", show: (p) => num(p.heightAdjMm, " mm") },
  { key: "pivot", label: "Xoay dọc", show: (p) => yn(p.pivot) },
  { key: "kvm", label: "KVM", show: (p) => yn(p.kvm) },
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
export function rowIsSame(field: CompareField, items: Comparable[]): boolean {
  const texts = items.map(field.show);
  return texts.every((t) => t === texts[0]);
}
