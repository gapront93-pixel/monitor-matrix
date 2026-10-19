// Display formats. Numbers are always en-US ("16,490,000"), dates dd/mm/yyyy in Vietnam time.

const TZ = "Asia/Ho_Chi_Minh";

export function fmtNum(n: number | null | undefined): string {
  return n === null || n === undefined ? "" : n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** "[ 16,490,000 ]" */
export function fmtPriceCell(n: number): string {
  return `[ ${fmtNum(n)} ]`;
}

/** Signed difference: "+800,000", "-220,000" */
export function fmtDiff(n: number): string {
  return (n > 0 ? "+" : n < 0 ? "-" : "") + Math.abs(n).toLocaleString("en-US");
}

function parts(d: Date): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d)) {
    out[p.type] = p.value;
  }
  return out;
}

/** 18/10/2026 */
export function fmtDate(d: Date): string {
  const p = parts(d);
  return `${p.day}/${p.month}/${p.year}`;
}

/** 18/10 */
export function fmtDayMonth(d: Date): string {
  const p = parts(d);
  return `${p.day}/${p.month}`;
}

/** 18/10/2026 08:30 */
export function fmtDateTime(d: Date): string {
  const p = parts(d);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** 2026-10-18 (Vietnam day), used in URLs (?ngay=) */
export function isoDay(d: Date): string {
  const p = parts(d);
  return `${p.year}-${p.month}-${p.day}`;
}

/** End of a Vietnam day, for "prices as of that day" */
export function endOfVnDay(day: string): Date | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T23:59:59.999+07:00`) : null;
}

const RES: Record<string, string> = {
  "1920x1080": "FHD",
  "2560x1440": "QHD",
  "3440x1440": "UWQHD",
  "3840x2160": "4K",
  "5120x1440": "DQHD",
  "2560x1080": "UWFHD",
};

/** "2560x1440" -> "QHD" */
export function resLabel(res: string | null): string {
  return res ? (RES[res] ?? res) : "";
}

/** "2560x1440" -> "2560×1440" */
export function resPx(res: string | null): string {
  return res ? res.replace("x", "×") : "";
}

/** 27" WOLED 280Hz */
export function specLine(p: { sizeIn: number | null; panel: string | null; refreshHz: number | null }): string {
  return [p.sizeIn !== null ? `${p.sizeIn}"` : "", p.panel ?? "", p.refreshHz ? `${p.refreshHz}Hz` : ""].filter(Boolean).join(" ");
}

/** Model code of a rival for short labels: "ROG Strix OLED XG27AQWMG" -> "XG27AQWMG", "... PG32UCDM Gen3" -> "PG32UCDM Gen3" */
export function modelCode(model: string): string {
  const toks = model.match(/[A-Za-z0-9-]+/g) ?? [];
  const codes = toks.filter((t) => /\d/.test(t) && /[A-Za-z]/.test(t) && t.length >= 4 && !/^gen\d+$/i.test(t));
  const code = codes.reduce<string | null>((best, t) => (!best || t.length >= best.length ? t : best), null);
  if (!code) return model;
  const gen = model.match(/\bGen\s?\d+\b/i)?.[0];
  return gen ? `${code} ${gen}` : code;
}

// Order rivals are listed in, as in the design ("ASUS, MSI, Samsung, LG, Dell/Alienware")
export const RIVAL_BRANDS = ["ASUS", "MSI", "Samsung", "LG", "Dell"];

export function byRivalBrand(a: { brand: string; model: string }, b: { brand: string; model: string }): number {
  const ia = RIVAL_BRANDS.indexOf(a.brand), ib = RIVAL_BRANDS.indexOf(b.brand);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.model.localeCompare(b.model);
}
