import "server-only";

import { Pool } from "pg";

import type { Catalog } from "./catalog";
import { productIndex } from "./import/plan";
import { prisma } from "./prisma";
import { matchSale } from "./sales-map";

// LCD sell-in from vnpromotion's SaleRow, read with a SELECT-only role (SALES_DATABASE_URL).
// vnpromotion syncs its sheets hourly, so these numbers are always current.

const globalForSales = globalThis as unknown as { salesPool?: Pool };

function pool(): Pool {
  const url = process.env.SALES_DATABASE_URL;
  if (!url) throw new Error("SALES_DATABASE_URL is not set");
  globalForSales.salesPool ??= new Pool({ connectionString: url, max: 3, idleTimeoutMillis: 30_000, statement_timeout: 15_000 });
  return globalForSales.salesPool;
}

export function salesConfigured(): boolean {
  return !!process.env.SALES_DATABASE_URL;
}

export type SalesFilter = { from: string; to: string; npp: string | null }; // YYYY-MM months, inclusive

const monthStart = (m: string) => `${m}-01`;
function nextMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, "0")}-01`;
}

/** The months covered by LCD rows, and the NPPs seen */
export async function salesRange(): Promise<{ first: string | null; last: string | null; lastDay: Date | null; npps: string[] }> {
  const [r, n] = await Promise.all([
    pool().query<{ first: Date | null; last: Date | null }>(`select min(date) as first, max(date) as last from "SaleRow" where cat = 'LCD'`),
    pool().query<{ npp: string }>(`select distinct npp from "SaleRow" where cat = 'LCD' and npp is not null and npp <> '' order by 1`),
  ]);
  const f = r.rows[0]?.first, l = r.rows[0]?.last;
  const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return { first: f ? ym(f) : null, last: l ? ym(l) : null, lastDay: l ?? null, npps: n.rows.map((x) => x.npp) };
}

type Row = { model: string | null; so_model: string | null; qty: string; amount: string };

export type SalesItem = {
  key: string;
  label: string;
  productSlug: string | null;
  qty: number;
  amount: number;
};

export type SalesReport = {
  totals: { qty: number; amount: number; models: number; customers: number };
  previous: { qty: number; amount: number } | null; // the same number of months just before
  months: { month: string; qty: number; amount: number }[];
  models: (SalesItem & { segmentId: string | null; sizeIn: number | null; panel: string | null; minPrice: number | null; thumb: string | null })[];
  unmatched: number; // units whose model is not in the catalog
  customers: (SalesItem & { npp: string | null })[];
  npps: SalesItem[];
};

function where(f: SalesFilter, start = 1): { sql: string; params: string[] } {
  const params = [monthStart(f.from), nextMonth(f.to)];
  let sql = `cat = 'LCD' and date >= $${start} and date < $${start + 1}`;
  if (f.npp) {
    params.push(f.npp);
    sql += ` and npp = $${start + 2}`;
  }
  return { sql, params };
}

function monthsBetween(from: string, to: string): number {
  const [a, b] = [from, to].map((m) => m.split("-").map(Number));
  return (b[0] - a[0]) * 12 + (b[1] - a[1]) + 1;
}

function shiftMonth(m: string, by: number): string {
  const [y, mo] = m.split("-").map(Number);
  const t = y * 12 + (mo - 1) + by;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

export async function salesReport(f: SalesFilter, catalog: Catalog): Promise<SalesReport> {
  const w = where(f);
  const span = monthsBetween(f.from, f.to);
  const prev = where({ from: shiftMonth(f.from, -span), to: shiftMonth(f.from, -1), npp: f.npp });
  const db = pool();
  const [byModel, byMonth, byCustomer, byNpp, customers, prevTotals, products] = await Promise.all([
    db.query<Row>(`select model, "soModel" as so_model, sum(quantity)::text as qty, sum(amount)::text as amount from "SaleRow" where ${w.sql} group by 1, 2`, w.params),
    db.query<{ month: string; qty: string; amount: string }>(
      `select to_char(date, 'YYYY-MM') as month, sum(quantity)::text as qty, sum(amount)::text as amount from "SaleRow" where ${w.sql} group by 1 order by 1`,
      w.params,
    ),
    db.query<{ name: string; npp: string | null; qty: string; amount: string }>(
      `select coalesce(nullif("shortName", ''), customer, '?') as name, min(npp) as npp, sum(quantity)::text as qty, sum(amount)::text as amount
       from "SaleRow" where ${w.sql} group by 1 order by sum(quantity) desc limit 20`,
      w.params,
    ),
    db.query<{ name: string; qty: string; amount: string }>(
      `select coalesce(nullif(npp, ''), '?') as name, sum(quantity)::text as qty, sum(amount)::text as amount from "SaleRow" where ${w.sql} group by 1 order by 2 desc`,
      w.params,
    ),
    db.query<{ n: string }>(`select count(distinct coalesce(nullif("shortName", ''), customer))::text as n from "SaleRow" where ${w.sql}`, w.params),
    db.query<{ qty: string | null; amount: string | null }>(`select sum(quantity)::text as qty, sum(amount)::text as amount from "SaleRow" where ${prev.sql}`, prev.params),
    prisma.product.findMany({ where: { isGigabyte: true }, select: { id: true, slug: true, model: true, aliases: true } }),
  ]);

  const idx = productIndex(products);
  const byId = new Map(products.map((p) => [p.id, p]));
  const merged = new Map<string, SalesReport["models"][number]>();
  let unmatched = 0;
  for (const r of byModel.rows) {
    const qty = Number(r.qty), amount = Number(r.amount);
    const id = matchSale(r.model, r.so_model, idx, (x) => byId.get(x)?.model ?? "");
    const p = id ? byId.get(id) : undefined;
    const view = p ? catalog.bySlug.get(p.slug) : undefined;
    const key = p ? p.slug : `?${r.so_model || r.model || "?"}`;
    if (!p) unmatched += qty;
    const cur = merged.get(key) ?? {
      key,
      label: p ? p.model : (r.so_model || r.model || "?"),
      productSlug: p?.slug ?? null,
      qty: 0,
      amount: 0,
      segmentId: view?.segmentId ?? null,
      sizeIn: view?.sizeIn ?? null,
      panel: view?.panel ?? null,
      minPrice: view?.minPrice ?? null,
      thumb: view?.thumb ?? null,
    };
    cur.qty += qty;
    cur.amount += amount;
    merged.set(key, cur);
  }
  const models = [...merged.values()].filter((m) => m.qty !== 0 || m.amount !== 0).sort((a, b) => b.qty - a.qty || b.amount - a.amount);

  // Every month of the range, zero when nothing was sold
  const monthMap = new Map(byMonth.rows.map((m) => [m.month, m]));
  const months = Array.from({ length: span }, (_, i) => {
    const m = shiftMonth(f.from, i);
    const r = monthMap.get(m);
    return { month: m, qty: Number(r?.qty ?? 0), amount: Number(r?.amount ?? 0) };
  });

  const qty = months.reduce((n, m) => n + m.qty, 0);
  const amount = months.reduce((n, m) => n + m.amount, 0);
  const pq = prevTotals.rows[0];
  return {
    totals: { qty, amount, models: models.filter((m) => m.productSlug && m.qty > 0).length, customers: Number(customers.rows[0]?.n ?? 0) },
    previous: pq?.qty !== null && pq?.qty !== undefined ? { qty: Number(pq.qty), amount: Number(pq.amount ?? 0) } : null,
    months,
    models,
    unmatched,
    customers: byCustomer.rows.map((c) => ({ key: c.name, label: c.name, productSlug: null, npp: c.npp, qty: Number(c.qty), amount: Number(c.amount) })),
    npps: byNpp.rows.map((n) => ({ key: n.name, label: n.name, productSlug: null, qty: Number(n.qty), amount: Number(n.amount) })),
  };
}
