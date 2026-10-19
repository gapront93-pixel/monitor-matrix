import "server-only";

import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { YEARS, rowsOf, type ImportData } from "./imports";
import { codeTokens, normKey } from "./normalize";
import { prisma } from "./prisma";

// Units imported and average FOB of catalog models, from the customs RAW data (data/import). Used to keep only
// rivals actually imported lately and to show their FOB next to the dealer price.

export const IMPORT_WINDOW_MONTHS = 9;
const FILE = path.join(process.cwd(), "data", "import", "import-raw-2024-2026.json");

type Entry = { date: number; qty: number; rev: number }; // date as YYYYMMDD
type Keyed = Map<string, Entry[]>; // model key -> rows
type Index = Map<string, { full: Keyed; token: Keyed }>; // brand -> rows by whole model code / by code token

const g = globalThis as unknown as { importIndex?: { mtime: number; index: Index } };

const brandKey = (b: string) => normKey(b);
// "Q27G41ZDP/71" -> "q27g41zdp"; "27GX704A-B" -> "27gx704ab" (tokens: "27gx704a")
const fullKey = (model: string) => normKey(model.split("/")[0]);
const push = (m: Keyed, k: string, e: Entry) => {
  const list = m.get(k);
  if (list) list.push(e);
  else m.set(k, [e]);
};

async function loadIndex(): Promise<Index> {
  const mtime = (await stat(FILE)).mtimeMs;
  if (g.importIndex?.mtime === mtime) return g.importIndex.index;
  const d: ImportData = JSON.parse(await readFile(FILE, "utf8"));
  const index: Index = new Map();
  for (const y of YEARS) {
    for (const r of rowsOf(d, y)) {
      const b = brandKey(d.dicts.brand[r[4]]);
      let byBrand = index.get(b);
      if (!byBrand) index.set(b, (byBrand = { full: new Map(), token: new Map() }));
      const e = { date: y * 10000 + r[0] * 100 + r[1], qty: r[11], rev: r[12] };
      const model = d.dicts.model[r[3]];
      push(byBrand.full, fullKey(model), e);
      for (const k of new Set(codeTokens(model.split("/")[0]))) push(byBrand.token, k, e);
    }
  }
  g.importIndex = { mtime, index };
  return index;
}

export type ImportStat = { qty: number; rev: number; fob: number | null };

/** First day counted: the same day IMPORT_WINDOW_MONTHS months before `now` (Vietnam calendar is close enough here) */
export function windowStart(now: Date): number {
  const d = new Date(now);
  d.setMonth(d.getMonth() - IMPORT_WINDOW_MONTHS);
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/**
 * Import units / value / average FOB over the last 9 months, by product slug. A product matches customs rows of the
 * same brand by its whole model code (model name or an alias); only when none match, by its code tokens
 * ("27GR93U" in "UltraGear 27GR93U-B"), so "MAG 272QP X24" never borrows the rows of "MAG 272QP X50".
 */
export async function importStats(products: { id: number; slug: string; brand: string; model: string }[], now = new Date()): Promise<Map<string, ImportStat>> {
  const out = new Map<string, ImportStat>();
  if (!products.length) return out;
  let index: Index;
  try {
    index = await loadIndex();
  } catch {
    return out; // no import file: no import figures
  }
  const aliases = new Map(
    (await prisma.product.findMany({ where: { id: { in: products.map((p) => p.id) } }, select: { id: true, aliases: true } })).map((p) => [p.id, p.aliases]),
  );
  const from = windowStart(now);
  for (const p of products) {
    const byBrand = index.get(brandKey(p.brand));
    if (!byBrand) {
      out.set(p.slug, { qty: 0, rev: 0, fob: null });
      continue;
    }
    const full = new Set([normKey(p.model), ...(aliases.get(p.id) ?? [])].filter((k) => k.length >= 5));
    const collect = (m: Keyed, keys: Iterable<string>) => {
      // One customs row can sit under several keys of the same product: count it once
      const seen = new Set<Entry>();
      for (const k of keys) for (const e of m.get(k) ?? []) seen.add(e);
      return [...seen];
    };
    let rows = collect(byBrand.full, full);
    if (!rows.length) rows = collect(byBrand.token, codeTokens(p.model));
    let qty = 0, rev = 0;
    for (const e of rows) {
      if (e.date < from) continue;
      qty += e.qty;
      rev += e.rev;
    }
    out.set(p.slug, { qty, rev, fob: qty > 0 ? Math.round((rev / qty) * 10) / 10 : null });
  }
  return out;
}
