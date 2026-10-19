// Reads price files (data/prices/<dealer>.json or the bang-gia.csv table) into plain rows.
// Pure functions: used by scripts/seed.ts and by the admin upload preview.
import { cleanStr, normKey, parseVnd, stripParens } from "../normalize";
import { parseCsv } from "./csv";

export type StockStatus = "in_stock" | "out_of_stock" | "discontinued" | "contact" | "unknown";

export type DealerInfo = {
  id: string;
  name: string;
  website: string | null;
  status: string;
  note: string | null;
};

export type PriceRow = {
  dealerId: string;
  slugInFile: string | null;
  nameOnSite: string;
  priceVnd: number | null;
  listPriceVnd: number | null;
  url: string | null;
  note: string | null;
};

export type ParsedPriceFile = {
  format: "dealer-json" | "bang-gia-csv";
  capturedAt: Date | null; // null: the file has no date, the admin picks one
  dealers: DealerInfo[]; // dealers this file covers
  rows: PriceRow[];
  warnings: string[];
};

/** "2026-10-18" -> midnight in Vietnam (UTC+7) */
export function vnDate(day: string): Date | null {
  const m = day.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00+07:00`) : null;
}

/** Same rules as the approved bang-gia-man-hinh.html: "hết hàng", "ngừng kinh doanh" and "sắp về" are not buyable */
export function classifyStock(note: string | null, priceVnd: number | null): { stockStatus: StockStatus; inStock: boolean | null } {
  const n = (note ?? "").normalize("NFC").toLowerCase();
  if (/ngừng kinh doanh/.test(n)) return { stockStatus: "discontinued", inStock: false };
  if (/hết hàng|sắp về/.test(n)) return { stockStatus: "out_of_stock", inStock: false };
  if (priceVnd === null) return { stockStatus: "contact", inStock: null };
  if (/còn hàng|sẵn hàng|có hàng|in stock/.test(n)) return { stockStatus: "in_stock", inStock: true };
  return { stockStatus: "unknown", inStock: null };
}

export function isBuyable(s: StockStatus): boolean {
  return s !== "out_of_stock" && s !== "discontinued";
}

type DealerJson = {
  retailer?: unknown;
  retailer_id?: unknown;
  site?: unknown;
  status?: unknown;
  fetched?: unknown;
  note?: unknown;
  notes?: unknown;
  items?: unknown;
};

/** One dealer object, or an array of them */
export function parseDealerJson(text: string): ParsedPriceFile {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    throw new Error("File JSON không hợp lệ (không đọc được).");
  }
  const list = (Array.isArray(data) ? data : [data]) as DealerJson[];
  const out: ParsedPriceFile = { format: "dealer-json", capturedAt: null, dealers: [], rows: [], warnings: [] };
  for (const [i, d] of list.entries()) {
    const id = cleanStr(d?.retailer_id);
    const name = cleanStr(d?.retailer) ?? id;
    if (!id || !name || !Array.isArray(d.items)) {
      throw new Error(`Mục thứ ${i + 1} thiếu "retailer_id", "retailer" hoặc "items".`);
    }
    out.dealers.push({
      id,
      name,
      website: cleanStr(d.site),
      status: cleanStr(d.status) ?? "ok",
      note: cleanStr(d.note) ?? cleanStr(d.notes),
    });
    const day = cleanStr(d.fetched);
    const at = day ? vnDate(day) : null;
    if (at && (!out.capturedAt || at > out.capturedAt)) out.capturedAt = at;
    for (const it of d.items as Record<string, unknown>[]) {
      out.rows.push({
        dealerId: id,
        slugInFile: cleanStr(it.slug),
        nameOnSite: cleanStr(it.name_on_site) ?? cleanStr(it.slug) ?? "(không tên)",
        priceVnd: parseVnd(it.price_vnd),
        listPriceVnd: parseVnd(it.list_price_vnd),
        url: cleanStr(it.url),
        note: cleanStr(it.note),
      });
    }
  }
  return out;
}

/** Price cell of bang-gia.csv: "16490000", "16,490,000", "Liên hệ", "16490000 (Hết hàng)" */
function parseCell(cell: string): { price: number | null; note: string | null } {
  const m = cell.match(/\d[\d.,\s]*\d|\d/);
  const price = m ? parseVnd(m[0]) : null;
  const rest = cell.replace(m?.[0] ?? "", "").replace(/[()\[\];]/g, " ").replace(/\s+/g, " ").trim();
  return { price, note: rest || null };
}

/** bang-gia.csv: model, slug, one column per dealer (header = dealer name or id), gia_thap_nhat, so_noi_ban */
export function parseBangGiaCsv(text: string, knownDealers: { id: string; name: string }[]): ParsedPriceFile {
  const table = parseCsv(text);
  if (table.length < 2) throw new Error("File CSV trống.");
  const header = table[0].map((h) => h.trim());
  const slugCol = header.findIndex((h) => normKey(h) === "slug");
  const modelCol = header.findIndex((h) => normKey(h) === "model");
  if (slugCol < 0 && modelCol < 0) throw new Error('File CSV cần có cột "slug" hoặc "model".');

  const byKey = new Map<string, { id: string; name: string }>();
  for (const d of knownDealers) {
    byKey.set(normKey(d.id), d);
    byKey.set(normKey(d.name), d);
    byKey.set(normKey(stripParens(d.name)), d);
  }
  const skip = new Set(["model", "slug", "giathapnhat", "sonoiban", "sonoiconhang"]);
  const out: ParsedPriceFile = { format: "bang-gia-csv", capturedAt: null, dealers: [], rows: [], warnings: [] };
  const cols: { idx: number; dealerId: string }[] = [];
  header.forEach((h, idx) => {
    const k = normKey(h);
    if (!k || skip.has(k)) return;
    const d = byKey.get(k) ?? byKey.get(normKey(stripParens(h)));
    if (!d) {
      out.warnings.push(`Cột "${h}" không khớp đại lý nào, đã bỏ qua. Thêm đại lý này ở mục Đại lý trước nếu cần.`);
      return;
    }
    cols.push({ idx, dealerId: d.id });
    out.dealers.push({ id: d.id, name: d.name, website: null, status: "ok", note: null });
  });

  for (const r of table.slice(1)) {
    const slug = slugCol >= 0 ? cleanStr(r[slugCol]) : null;
    const model = modelCol >= 0 ? cleanStr(r[modelCol]) : null;
    if (!slug && !model) continue;
    for (const c of cols) {
      const cell = cleanStr(r[c.idx]);
      if (!cell) continue;
      const { price, note } = parseCell(cell);
      out.rows.push({
        dealerId: c.dealerId,
        slugInFile: slug ?? model,
        nameOnSite: model ?? slug!,
        priceVnd: price,
        listPriceVnd: null,
        url: null,
        note: note ?? (price === null ? "Liên hệ" : null),
      });
    }
  }
  return out;
}

export function parsePriceFile(fileName: string, text: string, knownDealers: { id: string; name: string }[]): ParsedPriceFile {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".json")) return parseDealerJson(text);
  if (lower.endsWith(".csv")) return parseBangGiaCsv(text, knownDealers);
  throw new Error("Chỉ nhận file .json hoặc .csv.");
}
