import "server-only";

import { Pool } from "pg";

import type { Catalog } from "./catalog";
import { productIndex } from "./import/plan";
import { normKey } from "./normalize";
import { prisma } from "./prisma";
import { matchSale } from "./sales-map";
import { monthsBetween, shiftMonth } from "./sales-period";

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

type Row = { model: string | null; so_model: string | null; npp: string | null; segment: string | null; qty: string; amount: string };

export type SalesItem = {
  key: string;
  label: string;
  productSlug: string | null;
  qty: number;
  amount: number;
};

type MonthQA = { qty: number; amount: number };

export type SalesReport = {
  totals: { qty: number; amount: number; models: number; customers: number };
  previous: { qty: number; amount: number } | null; // the same number of months just before
  months: { month: string; qty: number; amount: number }[];
  // One row per SO Model (the code vnpromotion merges across NPPs), with the original codes behind it
  models: (SalesItem & {
    segmentId: string | null;
    sizeIn: number | null;
    panel: string | null;
    minPrice: number | null;
    thumb: string | null;
    sources: { model: string; npp: string; qty: number; amount: number }[];
  })[];
  unmatched: number; // units whose model is not in the catalog
  segments: (SalesItem & { models: number })[]; // the segment column of the sales sheet
  // Every dealer of the period (the screen filters by PIC), with the previous period and month by month for both
  customers: (SalesItem & { npp: string | null; pic: string | null; prevQty: number; prevAmount: number; series: { cur: MonthQA[]; prev: MonthQA[] } })[];
  npps: (SalesItem & { prevQty: number; prevAmount: number })[];
  pics: string[];
  prevMonths: string[]; // months of the previous period, same count as months
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

export async function salesReport(f: SalesFilter, catalog: Catalog): Promise<SalesReport> {
  const w = where(f);
  const span = monthsBetween(f.from, f.to);
  const prevFrom = shiftMonth(f.from, -span);
  const prev = where({ from: prevFrom, to: shiftMonth(f.from, -1), npp: f.npp });
  // Previous and current period together
  const both = where({ from: prevFrom, to: f.to, npp: f.npp });
  const curStart = `$${both.params.length + 1}::date`; // extra parameter: where the current period starts
  const db = pool();
  const [byModel, byMonth, byCustomer, byNpp, customerCount, prevTotals, products] = await Promise.all([
    db.query<Row>(`select model, nullif(trim("soModel"), '') as so_model, nullif(npp, '') as npp, nullif(trim(segment), '') as segment, sum(quantity)::text as qty, sum(amount)::text as amount
       from "SaleRow" where ${w.sql} group by 1, 2, 3, 4`, w.params),
    db.query<{ month: string; qty: string; amount: string }>(
      `select to_char(date, 'YYYY-MM') as month, sum(quantity)::text as qty, sum(amount)::text as amount from "SaleRow" where ${w.sql} group by 1 order by 1`,
      w.params,
    ),
    // Dealer x month over the current and the previous period together
    db.query<{ name: string; npp: string | null; pic: string | null; month: string; qty: string; amount: string }>(
      `select coalesce(nullif("shortName", ''), customer, '?') as name, min(npp) as npp, min(nullif("picCpn", '')) as pic,
              to_char(date, 'YYYY-MM') as month, sum(quantity)::text as qty, sum(amount)::text as amount
       from "SaleRow" where ${both.sql} group by 1, 4`,
      both.params,
    ),
    db.query<{ name: string; prev: boolean; qty: string; amount: string }>(
      `select coalesce(nullif(npp, ''), '?') as name, date < ${curStart} as prev, sum(quantity)::text as qty, sum(amount)::text as amount
       from "SaleRow" where ${both.sql} group by 1, 2`,
      [...both.params, monthStart(f.from)],
    ),
    db.query<{ n: string }>(`select count(distinct coalesce(nullif("shortName", ''), customer))::text as n from "SaleRow" where ${w.sql}`, w.params),
    db.query<{ qty: string | null; amount: string | null }>(`select sum(quantity)::text as qty, sum(amount)::text as amount from "SaleRow" where ${prev.sql}`, prev.params),
    prisma.product.findMany({ where: { isGigabyte: true }, select: { id: true, slug: true, model: true, aliases: true } }),
  ]);

  const idx = productIndex(products);
  const byId = new Map(products.map((p) => [p.id, p]));
  const merged = new Map<string, SalesReport["models"][number]>();
  const segs = new Map<string, SalesReport["segments"][number] & { names: Set<string> }>();
  let unmatched = 0;
  for (const r of byModel.rows) {
    const qty = Number(r.qty), amount = Number(r.amount);
    const id = matchSale(r.model, r.so_model, idx, (x) => byId.get(x)?.model ?? "");
    const p = id ? byId.get(id) : undefined;
    const view = p ? catalog.bySlug.get(p.slug) : undefined;
    if (!p) unmatched += qty;
    // The SO Model names the row; 2025 rows have none, so the catalog model (or the raw code) stands in
    const name = r.so_model ?? p?.model ?? r.model ?? "?";
    const key = normKey(name) || name;
    const cur = merged.get(key) ?? {
      key,
      label: name,
      productSlug: view ? p!.slug : null, // hidden models have no page
      qty: 0,
      amount: 0,
      segmentId: view?.segmentId ?? null,
      sizeIn: view?.sizeIn ?? null,
      panel: view?.panel ?? null,
      minPrice: view?.minPrice ?? null,
      thumb: view?.thumb ?? null,
      sources: [],
    };
    cur.qty += qty;
    cur.amount += amount;
    const src = r.model ?? name, npp = r.npp ?? "?";
    const s0 = cur.sources.find((x) => x.model === src && x.npp === npp);
    if (s0) {
      s0.qty += qty;
      s0.amount += amount;
    } else cur.sources.push({ model: src, npp, qty, amount });
    merged.set(key, cur);

    const segName = r.segment ?? "?";
    const sg = segs.get(segName) ?? { key: segName, label: segName, productSlug: null, qty: 0, amount: 0, models: 0, names: new Set<string>() };
    sg.qty += qty;
    sg.amount += amount;
    sg.names.add(key);
    segs.set(segName, sg);
  }
  for (const m of merged.values()) m.sources.sort((a, b) => b.amount - a.amount);
  const segments = [...segs.values()]
    .filter((x) => x.qty !== 0 || x.amount !== 0)
    .map(({ names, ...x }) => ({ ...x, models: names.size }))
    .sort((a, b) => b.amount - a.amount);
  const models = [...merged.values()].filter((m) => m.qty !== 0 || m.amount !== 0).sort((a, b) => b.qty - a.qty || b.amount - a.amount);

  // Every month of the range, zero when nothing was sold
  const monthMap = new Map(byMonth.rows.map((m) => [m.month, m]));
  const months = Array.from({ length: span }, (_, i) => {
    const m = shiftMonth(f.from, i);
    const r = monthMap.get(m);
    return { month: m, qty: Number(r?.qty ?? 0), amount: Number(r?.amount ?? 0) };
  });

  // Dealers: current period first, previous period beside it, month by month (position i of both periods lines up)
  const prevMonths = Array.from({ length: span }, (_, i) => shiftMonth(prevFrom, i));
  const curIdx = new Map(months.map((m, i) => [m.month, i]));
  const prevIdx = new Map(prevMonths.map((m, i) => [m, i]));
  const dealers = new Map<string, SalesReport["customers"][number]>();
  for (const r of byCustomer.rows) {
    const d = dealers.get(r.name) ?? {
      key: r.name,
      label: r.name,
      productSlug: null,
      npp: r.npp,
      pic: r.pic,
      qty: 0,
      amount: 0,
      prevQty: 0,
      prevAmount: 0,
      series: { cur: months.map(() => ({ qty: 0, amount: 0 })), prev: prevMonths.map(() => ({ qty: 0, amount: 0 })) },
    };
    d.npp ??= r.npp;
    d.pic ??= r.pic;
    const q = Number(r.qty), a = Number(r.amount);
    const ci = curIdx.get(r.month), pi = prevIdx.get(r.month);
    if (ci !== undefined) {
      d.qty += q;
      d.amount += a;
      d.series.cur[ci].qty += q;
      d.series.cur[ci].amount += a;
    } else if (pi !== undefined) {
      d.prevQty += q;
      d.prevAmount += a;
      d.series.prev[pi].qty += q;
      d.series.prev[pi].amount += a;
    }
    dealers.set(r.name, d);
  }
  // Dealers that only bought in the previous period are left out (nothing to show for this period)
  const customers = [...dealers.values()].filter((d) => d.qty !== 0 || d.amount !== 0).sort((a, b) => b.amount - a.amount);

  const nppMap = new Map<string, SalesReport["npps"][number]>();
  for (const r of byNpp.rows) {
    const n = nppMap.get(r.name) ?? { key: r.name, label: r.name, productSlug: null, qty: 0, amount: 0, prevQty: 0, prevAmount: 0 };
    if (r.prev) {
      n.prevQty += Number(r.qty);
      n.prevAmount += Number(r.amount);
    } else {
      n.qty += Number(r.qty);
      n.amount += Number(r.amount);
    }
    nppMap.set(r.name, n);
  }
  const nppRows = [...nppMap.values()].filter((n) => n.qty !== 0 || n.amount !== 0 || n.prevQty !== 0).sort((a, b) => b.amount - a.amount);

  const qty = months.reduce((n, m) => n + m.qty, 0);
  const amount = months.reduce((n, m) => n + m.amount, 0);
  const pq = prevTotals.rows[0];
  return {
    totals: { qty, amount, models: models.filter((m) => m.qty > 0).length, customers: Number(customerCount.rows[0]?.n ?? 0) },
    previous: pq?.qty !== null && pq?.qty !== undefined ? { qty: Number(pq.qty), amount: Number(pq.amount ?? 0) } : null,
    months,
    models,
    unmatched,
    segments,
    customers,
    npps: nppRows,
    pics: [...new Set(customers.map((c) => c.pic).filter((x): x is string => !!x))].sort(),
    prevMonths,
  };
}
