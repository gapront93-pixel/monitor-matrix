// Turns the rows of the "RAW 2026" sheet of "LCD IMPORT DATA - Analysis" into the page's ImportData (the same
// normalisation as the original data package). Pure: runs in the browser on upload (tested in import-convert.test.ts).
import { YEARS, type ImportData, type ImportRow, type Year } from "./imports";
import { normKey } from "./normalize";

// Header names of the sheet (row 1), matched loosely
const HEAD = {
  date: /^date$/i,
  month: /^month$/i,
  year: /^year$/i,
  imp: /cong\s*ty\s*nhap\s*khau/i,
  model: /^model$/i,
  brand: /^brand$/i,
  size: /^size$/i,
  type: /^type$/i,
  panel: /^panel$/i,
  res: /^resolution$/i,
  hz: /scan\s*frequency/i,
  fob: /^fob$/i,
  qty: /^qty$/i,
  rev: /^rev$/i,
  country: /thi\s*truong/i,
  port: /cua\s*khau/i,
  dk: /^dkgh$/i,
} as const;
type Col = keyof typeof HEAD;

export type ConvertResult =
  | { ok: true; data: ImportData; counts: Record<Year, number>; skipped: { otherYears: number; noQty: number }; latest: string }
  | { ok: false; error: "noHeader"; missing: Col[] };

const text = (v: unknown) => (v === null || v === undefined ? "" : String(v)).replace(/ /g, " ").replace(/\s+/g, " ").trim();
const num = (v: unknown) => {
  if (typeof v === "number") return v;
  const m = text(v).replace(",", ".").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
};
const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

// A port, a customs gate or a warehouse rather than a country ("CANG CAT LAI (HCM)", "ICD TRANSIMEX SG", "HA NOI")
const PORT_LIKE =
  /\b(CANG|CẢNG|ICD|CFS|CUA ?KHAU|CỬA KHẨU|CUAKHAU|PORT|HP|HCM|HO CHI MINH|HA ?NOI|DINH VU|LACH HUYEN|HATECO|VNSGN|VNHAN|DA NANG|YEN VIEN|MIPEC|SPITC|LOGISTICS|CTY|CT|CTTNHH|CÔNG TY|TNHH|NULL)\b|N\/A/i;
export const portLike = (v: string) => PORT_LIKE.test(v);

/** The two columns are swapped on many rows of the source: put the port-like value in "port" */
export function countryAndPort(a: string, b: string): [string, string] {
  if (portLike(a) && !portLike(b)) return [b, a];
  return [a, b];
}

const RES: Record<string, string> = { "<=HD": "HD", WXGA: "HD", FULLHD: "FULLHD" };
export const normRes = (v: string) => {
  const u = text(v).toUpperCase().replace(/\s+/g, "");
  return RES[u] ?? u;
};
export const normPanel = (v: string) => {
  const u = text(v).toUpperCase();
  if (/^MINI[\s-]?LED$/.test(u)) return "Mini LED";
  return u;
};
export const normType = (v: string) => (/curv/i.test(v) ? "Curved" : "Flat");

/**
 * Converts the sheet rows (first row = headers, cells as read from the workbook). `brands` are the brand names
 * already in use: a brand spelled differently ("VIEWSONIC", "E-dra") takes the known spelling.
 */
export function convertRaw(rows: unknown[][], brands: string[] = []): ConvertResult {
  const head = rows[0]?.map(text) ?? [];
  const idx = {} as Record<Col, number>;
  const missing: Col[] = [];
  for (const k of Object.keys(HEAD) as Col[]) {
    const i = head.findIndex((h) => HEAD[k].test(h));
    if (i < 0) missing.push(k);
    idx[k] = i;
  }
  // Date and month can stand in for each other; everything else is needed
  const need = missing.filter((k) => !(k === "date" && idx.month >= 0) && !(k === "month" && idx.date >= 0));
  if (need.length) return { ok: false, error: "noHeader", missing: need };

  // Known spellings; when a brand is listed twice ("Cooler Master" / "COOLER MASTER") the mixed-case one wins
  const known = new Map<string, string>();
  for (const b of brands) {
    const k = normKey(b), cur = known.get(k);
    if (!cur || (cur === cur.toUpperCase() && b !== b.toUpperCase())) known.set(k, b);
  }
  const dicts = { imp: [] as string[], model: [] as string[], brand: [] as string[], country: [] as string[], port: [] as string[], dk: [] as string[] };
  const ids = Object.fromEntries(Object.keys(dicts).map((k) => [k, new Map<string, number>()])) as Record<keyof typeof dicts, Map<string, number>>;
  const id = (k: keyof typeof dicts, v: string) => {
    let i = ids[k].get(v);
    if (i === undefined) {
      i = dicts[k].length;
      dicts[k].push(v);
      ids[k].set(v, i);
    }
    return i;
  };
  const out: Record<Year, ImportRow[]> = { 2024: [], 2025: [], 2026: [] };
  const skipped = { otherYears: 0, noQty: 0 };
  let latest = 0;

  for (const r of rows.slice(1)) {
    if (!r || r.every((c) => text(c) === "")) continue;
    const cell = (k: Col) => (idx[k] >= 0 ? r[idx[k]] : undefined);
    const d = cell("date");
    const date = d instanceof Date ? d : typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d) ? new Date(d) : null;
    const year = Math.round(num(cell("year"))) || (date ? date.getUTCFullYear() : 0);
    if (!YEARS.includes(year as Year)) {
      skipped.otherYears++;
      continue;
    }
    const qty = Math.round(num(cell("qty")));
    if (!qty) {
      skipped.noQty++;
      continue;
    }
    const m = Math.round(num(cell("month"))) || (date ? date.getUTCMonth() + 1 : 0);
    const day = date ? date.getUTCDate() : 1;
    const rawBrand = text(cell("brand"));
    const brand = known.get(normKey(rawBrand)) ?? rawBrand;
    if (!known.has(normKey(rawBrand))) known.set(normKey(rawBrand), rawBrand);
    const [country, port] = countryAndPort(text(cell("country")), text(cell("port")));
    const row: ImportRow = [
      m,
      day,
      id("imp", text(cell("imp")).toUpperCase()),
      id("model", text(cell("model")).toUpperCase()),
      id("brand", brand),
      num(cell("size")),
      normType(text(cell("type"))),
      normPanel(text(cell("panel"))),
      normRes(text(cell("res"))),
      Math.round(num(cell("hz"))),
      round(num(cell("fob")), 2),
      qty,
      Math.round(num(cell("rev"))),
      id("country", country),
      id("port", port),
      id("dk", text(cell("dk"))),
    ];
    out[year as Year].push(row);
    if (year === 2026) latest = Math.max(latest, m * 100 + day);
  }
  // Newest row of the newest year (2026 here) as MDD, like the original package
  const top = [...YEARS].reverse().find((y) => out[y].length) ?? 2026;
  if (top !== 2026) latest = Math.max(...out[top].map((x) => x[0] * 100 + x[1]));
  const data: ImportData = { meta: { latest }, dicts, r2024: out[2024], r2025: out[2025], r2026: out[2026] };
  const dd = String(latest % 100).padStart(2, "0"), mm = String(Math.floor(latest / 100)).padStart(2, "0");
  return { ok: true, data, counts: { 2024: out[2024].length, 2025: out[2025].length, 2026: out[2026].length }, skipped, latest: `${dd}/${mm}/${top}` };
}

/** Shape check of an uploaded ImportData before it replaces the file (the browser did the conversion) */
export function importDataProblem(d: unknown): string | null {
  if (!d || typeof d !== "object") return "not an object";
  const x = d as Partial<ImportData>;
  if (!x.meta || typeof x.meta.latest !== "number") return "meta.latest";
  const keys = ["imp", "model", "brand", "country", "port", "dk"] as const;
  if (!x.dicts || keys.some((k) => !Array.isArray(x.dicts![k]) || x.dicts![k].some((v) => typeof v !== "string"))) return "dicts";
  let total = 0;
  for (const y of YEARS) {
    const rows = x[`r${y}`];
    if (!Array.isArray(rows)) return `r${y}`;
    total += rows.length;
    for (const r of rows) {
      if (!Array.isArray(r) || r.length !== 16) return `r${y}: row shape`;
      if (![0, 1, 5, 9, 10, 11, 12].every((i) => typeof r[i] === "number" && Number.isFinite(r[i]))) return `r${y}: numbers`;
      if (![6, 7, 8].every((i) => typeof r[i] === "string")) return `r${y}: texts`;
      const ref: [number, (typeof keys)[number]][] = [[2, "imp"], [3, "model"], [4, "brand"], [13, "country"], [14, "port"], [15, "dk"]];
      if (ref.some(([i, k]) => {
        const v = r[i];
        return typeof v !== "number" || !Number.isInteger(v) || v < 0 || v >= x.dicts![k].length;
      }))
        return `r${y}: dictionary index`;
      if (r[0] < 1 || r[0] > 12) return `r${y}: month`;
    }
  }
  if (!total) return "no rows";
  if (total > 300_000) return "too many rows";
  return null;
}
