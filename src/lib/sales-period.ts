// Period presets of the LCD sales page, the same list as the vnpromotion dashboard. Pure (tested in sales-period.test.ts).
// Sales are grouped by month, so every period is a range of YYYY-MM months, both ends included.

export const RANGE_PRESETS = ["this-month", "last-month", "this-quarter", "last-quarter", "this-year", "last-year", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];
export const DEFAULT_RANGE: RangePreset = "last-quarter";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMonth(v: string | undefined | null): v is string {
  return !!v && MONTH.test(v);
}

export function shiftMonth(m: string, by: number): string {
  const [y, mo] = m.split("-").map(Number);
  const t = y * 12 + (mo - 1) + by;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

export function monthsBetween(from: string, to: string): number {
  const [a, b] = [from, to].map((m) => m.split("-").map(Number));
  return (b[0] - a[0]) * 12 + (b[1] - a[1]) + 1;
}

/** Months of a preset, seen from the current month `now` (YYYY-MM). Custom keeps from/to, swapped when reversed. */
export function resolveRange(preset: RangePreset, now: string, from?: string | null, to?: string | null): { from: string; to: string } {
  const year = now.slice(0, 4);
  const qStart = shiftMonth(`${year}-01`, Math.floor((Number(now.slice(5)) - 1) / 3) * 3);
  switch (preset) {
    case "this-month":
      return { from: now, to: now };
    case "last-month": {
      const m = shiftMonth(now, -1);
      return { from: m, to: m };
    }
    case "this-quarter":
      return { from: qStart, to: now }; // up to today, like the dashboard
    case "last-quarter":
      return { from: shiftMonth(qStart, -3), to: shiftMonth(qStart, -1) };
    case "this-year":
      return { from: `${year}-01`, to: now };
    case "last-year":
      return { from: `${Number(year) - 1}-01`, to: `${Number(year) - 1}-12` };
    case "custom": {
      if (!isMonth(from) || !isMonth(to)) return resolveRange(DEFAULT_RANGE, now);
      return from <= to ? { from, to } : { from: to, to: from };
    }
  }
}

/** The preset from the URL; anything unknown is the default */
export function parsePreset(v: string | undefined): RangePreset {
  return RANGE_PRESETS.includes(v as RangePreset) ? (v as RangePreset) : DEFAULT_RANGE;
}
