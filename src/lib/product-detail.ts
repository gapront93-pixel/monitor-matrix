import "server-only";

import type { ProductView } from "./catalog";
import { endOfVnDay, isoDay } from "./format";
import { getPriceState } from "./import/plan";
import { prisma } from "./prisma";
import { lowestPrice, type PriceCell } from "./pricing";

export type HistoryPoint = { day: string; label: string; min: number | null } & Record<string, number | null | string>;
export type HistorySeries = { key: string; name: string };

/**
 * Price history of one product, one point per import day (newest 12):
 * the lowest retail price, plus up to two dealers (key dealers that list it most often).
 */
export async function priceHistory(
  product: ProductView,
  dealers: { id: string; name: string; isKey: boolean; priceType: "retail" | "dealer"; visible: boolean }[],
): Promise<{ points: HistoryPoint[]; series: HistorySeries[] }> {
  const imports = await prisma.priceImport.findMany({ select: { capturedAt: true }, orderBy: { capturedAt: "desc" } });
  const days = [...new Set(imports.map((i) => isoDay(i.capturedAt)))].slice(0, 12).reverse();
  const byDealer = new Map(dealers.map((d) => [d.id, d]));

  const perDay: { day: string; cells: PriceCell[] }[] = [];
  for (const day of days) {
    const state = await getPriceState(prisma, endOfVnDay(day)!);
    const cells: PriceCell[] = [];
    for (const [dealerId, s] of state) {
      const snap = s.snaps.get(product.id);
      const d = byDealer.get(dealerId);
      if (!snap || !d?.visible) continue;
      cells.push({ ...snap, dealerId, priceType: d.priceType });
    }
    perDay.push({ day, cells });
  }

  // Dealers to draw: retail, priced on the most days, key dealers first
  const seen = new Map<string, number>();
  for (const { cells } of perDay) for (const c of cells) if (c.priceVnd !== null && c.priceType === "retail") seen.set(c.dealerId, (seen.get(c.dealerId) ?? 0) + 1);
  const picked = [...seen.entries()]
    .sort((a, b) => b[1] - a[1] || Number(byDealer.get(b[0])!.isKey) - Number(byDealer.get(a[0])!.isKey))
    .slice(0, 2)
    .map(([id]) => id);

  const points = perDay.map(({ day, cells }) => {
    const pt: HistoryPoint = { day, label: `${day.slice(8, 10)}/${day.slice(5, 7)}`, min: lowestPrice(cells).price };
    for (const id of picked) pt[id] = cells.find((c) => c.dealerId === id)?.priceVnd ?? null;
    return pt;
  });
  return { points, series: picked.map((id) => ({ key: id, name: byDealer.get(id)!.name })) };
}

export type BenchmarkCard = {
  key: string;
  source: string;
  url: string;
  dateText: string | null;
  subject: string;
  verdict: string | null;
  metrics: { metric: string; value: string }[];
};

const VERDICT_ONLY = "Nhận xét";

/** "2026-03-25" -> "03/2026", "2021-04" -> "04/2021", "2026" -> "2026" */
export function reviewMonth(dateText: string | null): string | null {
  if (!dateText) return null;
  const m = dateText.match(/^(\d{4})(?:-(\d{2}))?/);
  return m ? (m[2] ? `${m[2]}/${m[1]}` : m[1]) : dateText;
}

/** Group benchmark rows into one card per review (source + link + subject) */
export function toCards(
  rows: { source: string; url: string; dateText: string | null; subject: string; verdict: string | null; metric: string; value: string }[],
): BenchmarkCard[] {
  const cards = new Map<string, BenchmarkCard>();
  for (const r of rows) {
    const key = `${r.source}|${r.url}|${r.subject}`;
    let c = cards.get(key);
    if (!c) {
      c = { key, source: r.source, url: r.url, dateText: r.dateText, subject: r.subject, verdict: r.verdict, metrics: [] };
      cards.set(key, c);
    }
    if (r.metric !== VERDICT_ONLY && r.value) c.metrics.push({ metric: r.metric, value: r.value });
  }
  return [...cards.values()].sort((a, b) => (b.dateText ?? "").localeCompare(a.dateText ?? ""));
}

function codeOf(model: string): string {
  return model.replace(/\s*\([^)]*\)/g, "").trim();
}

/** Reviews of this product, plus reviews in its segment whose subject names it ("M27U / M27UA / M28U") */
export async function productBenchmarks(p: { id: number; model: string; segmentId: string | null }): Promise<BenchmarkCard[]> {
  const rows = await prisma.benchmark.findMany({
    where: p.segmentId ? { OR: [{ productId: p.id }, { segmentId: p.segmentId }] } : { productId: p.id },
    orderBy: [{ date: "desc" }, { id: "asc" }],
  });
  const code = codeOf(p.model).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const named = new RegExp(`(^|[^a-z0-9])${code}([^a-z0-9]|$)`, "i");
  return toCards(rows.filter((r) => r.productId === p.id || named.test(r.subject)));
}

export async function segmentBenchmarks(segmentId: string): Promise<BenchmarkCard[]> {
  // Reviews filed under the segment, plus those of its current models (the lineup moved models between segments);
  // reviews of hidden models are left out
  return toCards(
    await prisma.benchmark.findMany({
      where: {
        OR: [{ segmentId, productId: null }, { product: { segmentId, hidden: false } }],
      },
      orderBy: [{ date: "desc" }, { id: "asc" }],
    }),
  );
}
