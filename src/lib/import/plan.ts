// Turns a parsed price file into a plan (what changes vs the current prices), then applies it as one PriceImport.
import type { PrismaClient } from "../../generated/prisma/client";
import { normKey } from "../normalize";
import { classifyStock, type DealerInfo, type ParsedPriceFile, type PriceRow, type StockStatus, isBuyable } from "./prices";

type Db = PrismaClient;

export type ProductRef = { id: number; slug: string; model: string; aliases: string[] };

export type StateSnap = {
  productId: number;
  priceVnd: number | null;
  listPriceVnd: number | null;
  inStock: boolean | null;
  stockStatus: StockStatus;
  note: string | null;
  nameOnSite: string | null;
  url: string | null;
  capturedAt: Date;
};

export type DealerState = { importId: number; capturedAt: Date; snaps: Map<number, StateSnap> };

/**
 * Prices as they stood at `at` (default: now). For each dealer, the newest import (capturedAt <= at)
 * that covered that dealer wins, so a product a dealer stopped listing drops out.
 */
export async function getPriceState(db: Db, at?: Date): Promise<Map<string, DealerState>> {
  const cover = await db.priceImportDealer.findMany({
    where: at ? { import: { capturedAt: { lte: at } } } : undefined,
    select: { dealerId: true, importId: true, import: { select: { capturedAt: true, createdAt: true } } },
  });
  const latest = new Map<string, { importId: number; capturedAt: Date; createdAt: Date }>();
  for (const c of cover) {
    const cur = latest.get(c.dealerId);
    const cand = { importId: c.importId, ...c.import };
    if (
      !cur ||
      cand.capturedAt > cur.capturedAt ||
      (+cand.capturedAt === +cur.capturedAt && cand.createdAt > cur.createdAt)
    ) {
      latest.set(c.dealerId, cand);
    }
  }
  const state = new Map<string, DealerState>();
  if (!latest.size) return state;
  const snaps = await db.priceSnapshot.findMany({
    where: { OR: [...latest].map(([dealerId, l]) => ({ dealerId, importId: l.importId })) },
  });
  for (const [dealerId, l] of latest) state.set(dealerId, { importId: l.importId, capturedAt: l.capturedAt, snaps: new Map() });
  for (const s of snaps) {
    state.get(s.dealerId)!.snaps.set(s.productId, {
      productId: s.productId,
      priceVnd: s.priceVnd,
      listPriceVnd: s.listPriceVnd,
      inStock: s.inStock,
      stockStatus: s.stockStatus as StockStatus,
      note: s.note,
      nameOnSite: s.nameOnSite,
      url: s.url,
      capturedAt: s.capturedAt,
    });
  }
  return state;
}

/** normKey(slug | model | alias) -> product ids */
export function productIndex(products: ProductRef[]): Map<string, number[]> {
  const idx = new Map<string, number[]>();
  const add = (k: string, id: number) => {
    if (!k) return;
    const ids = idx.get(k) ?? [];
    if (!ids.includes(id)) ids.push(id);
    idx.set(k, ids);
  };
  for (const p of products) {
    add(normKey(p.slug), p.id);
    add(normKey(p.model), p.id);
    for (const a of p.aliases) add(normKey(a), p.id);
  }
  return idx;
}

export type PlannedSnapshot = Omit<StateSnap, "capturedAt"> & { dealerId: string };

export type ChangeKind = "new" | "removed" | "price" | "stock" | "same";
export type Change = {
  kind: ChangeKind;
  dealerId: string;
  productId: number;
  before: { priceVnd: number | null; stockStatus: StockStatus } | null;
  after: { priceVnd: number | null; stockStatus: StockStatus } | null;
};

export type UnmatchedRow = PriceRow & { reason: string };

export type ImportPlan = {
  capturedAt: Date;
  format: ParsedPriceFile["format"];
  dealers: DealerInfo[];
  newDealers: DealerInfo[];
  snapshots: PlannedSnapshot[];
  unmatched: UnmatchedRow[];
  changes: Change[];
  counts: Record<ChangeKind | "unmatched" | "duplicates", number>;
  warnings: string[];
};

/** A dealer that lists one model twice: keep the buyable listing, then the lower price (as the approved HTML does) */
function better(a: PlannedSnapshot, b: PlannedSnapshot): PlannedSnapshot {
  const ab = isBuyable(a.stockStatus), bb = isBuyable(b.stockStatus);
  if (ab !== bb) return ab ? a : b;
  return (b.priceVnd ?? Infinity) < (a.priceVnd ?? Infinity) ? b : a;
}

export type PlanOptions = {
  /** The file is a partial update: prices the file does not mention are carried over instead of dropped */
  keepMissing?: boolean;
};

export async function buildPlan(db: Db, parsed: ParsedPriceFile, capturedAt: Date, opts: PlanOptions = {}): Promise<ImportPlan> {
  const [products, known, state] = await Promise.all([
    db.product.findMany({ select: { id: true, slug: true, model: true, aliases: true } }),
    db.dealer.findMany({ select: { id: true } }),
    getPriceState(db),
  ]);
  return planImport(parsed, capturedAt, productIndex(products), state, new Set(known.map((d) => d.id)), opts);
}

/** The diff itself, without the database: matched rows, unmatched rows and what changes against `state` */
export function planImport(
  parsed: ParsedPriceFile,
  capturedAt: Date,
  idx: Map<string, number[]>,
  state: Map<string, DealerState>,
  knownIds: Set<string>,
  opts: PlanOptions = {},
): ImportPlan {
  const unmatched: UnmatchedRow[] = [];
  const chosen = new Map<string, PlannedSnapshot>();
  let duplicates = 0;
  for (const row of parsed.rows) {
    const keys = [row.slugInFile, row.nameOnSite].filter(Boolean).map((k) => normKey(k!));
    const ids = keys.map((k) => idx.get(k)).find((v) => v && v.length);
    if (!ids) {
      unmatched.push({ ...row, reason: row.slugInFile ? `Không có mẫu "${row.slugInFile}"` : "Không có mã mẫu" });
      continue;
    }
    if (ids.length > 1) {
      unmatched.push({ ...row, reason: `"${row.slugInFile ?? row.nameOnSite}" khớp nhiều mẫu` });
      continue;
    }
    const productId = ids[0];
    const { stockStatus, inStock } = classifyStock(row.note, row.priceVnd);
    const prev = state.get(row.dealerId)?.snaps.get(productId);
    const snap: PlannedSnapshot = {
      productId,
      dealerId: row.dealerId,
      priceVnd: row.priceVnd,
      listPriceVnd: row.listPriceVnd,
      inStock,
      stockStatus,
      note: row.note,
      nameOnSite: row.nameOnSite,
      // CSV tables carry no links: keep the dealer page from the previous import
      url: row.url ?? prev?.url ?? null,
    };
    const key = `${row.dealerId}|${productId}`;
    const had = chosen.get(key);
    if (had) duplicates++;
    chosen.set(key, had ? better(had, snap) : snap);
  }
  const snapshots = [...chosen.values()];

  const changes: Change[] = [];
  const covered = new Set(parsed.dealers.map((d) => d.id));
  for (const s of snapshots) {
    const prev = state.get(s.dealerId)?.snaps.get(s.productId);
    const after = { priceVnd: s.priceVnd, stockStatus: s.stockStatus };
    if (!prev) changes.push({ kind: "new", dealerId: s.dealerId, productId: s.productId, before: null, after });
    else {
      const before = { priceVnd: prev.priceVnd, stockStatus: prev.stockStatus };
      const kind: ChangeKind =
        prev.priceVnd !== s.priceVnd ? "price" : isBuyable(prev.stockStatus) !== isBuyable(s.stockStatus) ? "stock" : "same";
      changes.push({ kind, dealerId: s.dealerId, productId: s.productId, before, after });
    }
  }
  for (const dealerId of covered) {
    for (const [productId, prev] of state.get(dealerId)?.snaps ?? []) {
      if (chosen.has(`${dealerId}|${productId}`)) continue;
      if (opts.keepMissing) {
        const { capturedAt: _at, ...kept } = prev;
        void _at;
        snapshots.push({ ...kept, dealerId });
        changes.push({ kind: "same", dealerId, productId, before: { priceVnd: prev.priceVnd, stockStatus: prev.stockStatus }, after: { priceVnd: prev.priceVnd, stockStatus: prev.stockStatus } });
      } else {
        changes.push({
          kind: "removed",
          dealerId,
          productId,
          before: { priceVnd: prev.priceVnd, stockStatus: prev.stockStatus },
          after: null,
        });
      }
    }
  }
  const counts = { new: 0, removed: 0, price: 0, stock: 0, same: 0, unmatched: unmatched.length, duplicates };
  for (const c of changes) counts[c.kind]++;

  return {
    capturedAt,
    format: parsed.format,
    dealers: parsed.dealers,
    newDealers: parsed.dealers.filter((d) => !knownIds.has(d.id)),
    snapshots,
    unmatched,
    changes,
    counts,
    warnings: parsed.warnings,
  };
}

/** Writes the plan as one PriceImport. New dealers from a JSON file are created at the end of the column order. */
export async function applyPlan(
  db: Db,
  plan: ImportPlan,
  meta: { source: "seed" | "admin"; fileName: string | null },
): Promise<number> {
  return db.$transaction(
    async (tx) => {
      if (plan.newDealers.length) {
        const max = await tx.dealer.aggregate({ _max: { sortOrder: true } });
        let order = (max._max.sortOrder ?? 0) + 1;
        for (const d of plan.newDealers) {
          await tx.dealer.create({
            data: { id: d.id, name: d.name, website: d.website, status: d.status, note: d.note, sortOrder: order++ },
          });
        }
      }
      const imp = await tx.priceImport.create({
        data: {
          capturedAt: plan.capturedAt,
          source: meta.source,
          fileName: meta.fileName,
          summary: { ...plan.counts, dealers: plan.dealers.map((d) => d.id), format: plan.format },
        },
      });
      await tx.priceImportDealer.createMany({ data: plan.dealers.map((d) => ({ importId: imp.id, dealerId: d.id })) });
      await tx.priceSnapshot.createMany({
        data: plan.snapshots.map((s) => ({ ...s, importId: imp.id, capturedAt: plan.capturedAt })),
      });
      if (plan.unmatched.length) {
        await tx.unmatchedPrice.createMany({
          data: plan.unmatched.map((u) => ({
            importId: imp.id,
            dealerId: u.dealerId,
            nameOnSite: u.nameOnSite,
            slugInFile: u.slugInFile,
            priceVnd: u.priceVnd,
            url: u.url,
            note: [u.note, u.reason].filter(Boolean).join(" · "),
            capturedAt: plan.capturedAt,
          })),
        });
      }
      return imp.id;
    },
    { timeout: 60_000 },
  );
}
