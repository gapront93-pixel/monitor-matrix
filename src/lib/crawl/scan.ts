import "server-only";

import { isoDay } from "../format";
import { applyPlan, buildPlan, getPriceState, type StateSnap } from "../import/plan";
import { vnDate, type DealerInfo, type ParsedPriceFile, type PriceRow } from "../import/prices";
import { prisma } from "../prisma";
import { sellOutStatus } from "../sales";
import { extractOffer, offerNote, type PageOffer } from "./extract";
import { matchLink, pageLinks, type MatchProduct } from "./match";
import { LISTING_PAGES } from "./sources";

// "Quét giá": reads the dealer sites again and saves the result as one price import (source "crawl"),
// which the admin history shows and can undo like an upload.
// - Product pages known from the last import are read again (JSON-LD / meta price, see ./extract).
// - Category pages (./sources) are read to find models a dealer has started selling.
// - Models with no sell-out in the last 6 months are not read; their old rows are kept as they were.
// - A page that cannot be read keeps its old price; a page that is gone (404/410) drops the listing.

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const TIMEOUT_MS = 20_000;
const MAX_BYTES = 4 * 1024 * 1024;
const PAUSE_MS = 350; // between two requests to the same site
const PARALLEL_DEALERS = 8;

export type ScanProblem = { dealer: string; model: string; url: string; reason: string };

export type ScanResult = {
  importId: number | null;
  day: string;
  dealers: number;
  pages: number;
  counts: { price: number; new: number; removed: number; stock: number; same: number };
  found: { dealer: string; model: string; price: number | null }[]; // listings found on category pages
  problems: ScanProblem[]; // pages that could not be read (old price kept)
  stale: { model: string; lastSale: string }[]; // models left out: no sell-out in 6 months
  sellOut: boolean; // false: sales data unavailable, nothing was left out
};

export type ScanProgress = { total: number; done: number; dealer: string | null };

type Fetched = { status: number; html: string; url: string } | { error: string };

async function get(url: string): Promise<Fetched> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, "accept-language": "vi-VN,vi;q=0.9,en;q=0.5", accept: "text/html,application/xhtml+xml" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: "follow",
        cache: "no-store",
      });
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_BYTES) return { error: "trang quá lớn" };
      return { status: res.status, html: new TextDecoder().decode(buf), url: res.url };
    } catch (e) {
      if (attempt >= 1) return { error: e instanceof Error && e.name === "TimeoutError" ? "quá thời gian" : "không kết nối được" };
      await sleep(1500);
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isPage = (url: string | null): url is string => !!url && /^https?:\/\//i.test(url) && !/\.pdf(\?|$)/i.test(url);

function carried(slug: string, dealerId: string, s: StateSnap): PriceRow {
  return { dealerId, slugInFile: slug, nameOnSite: s.nameOnSite ?? slug, priceVnd: s.priceVnd, listPriceVnd: s.listPriceVnd, url: s.url, note: s.note };
}

function freshRow(slug: string, dealerId: string, url: string, o: PageOffer, prev: StateSnap | undefined): PriceRow {
  // Out-of-stock pages often hide the price: keep the last one, marked out of stock
  const hidden = o.priceVnd === null && (o.availability === "out_of_stock" || o.availability === "discontinued" || o.availability === "preorder");
  return {
    dealerId,
    slugInFile: slug,
    nameOnSite: o.name ?? prev?.nameOnSite ?? slug,
    priceVnd: hidden ? (prev?.priceVnd ?? null) : o.priceVnd,
    listPriceVnd: hidden ? (prev?.listPriceVnd ?? null) : o.listPriceVnd,
    url,
    note: offerNote(o),
  };
}

/** Runs `fn` over items with at most `n` at a time */
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => {
    for (let x = queue.shift(); x !== undefined; x = queue.shift()) await fn(x);
  }));
}

export async function runScan(userId: number, progress: (p: ScanProgress) => void): Promise<ScanResult> {
  const [dealers, products, state, sellOut] = await Promise.all([
    prisma.dealer.findMany({ where: { visible: true }, orderBy: { sortOrder: "asc" } }),
    prisma.product.findMany({ where: { isGigabyte: true }, select: { id: true, slug: true, model: true, hidden: true } }),
    getPriceState(prisma),
    sellOutStatus(true),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const stale = sellOut?.stale ?? new Map<number, Date>();
  const active: MatchProduct[] = products.filter((p) => !p.hidden && !stale.has(p.id));
  const isActive = new Set(active.map((p) => p.id));

  // Dealers with something to read: product pages from the last import or a category page
  const plans = dealers
    .map((d) => {
      const snaps = [...(state.get(d.id)?.snaps.values() ?? [])];
      const pages = snaps.filter((s) => isActive.has(s.productId) && isPage(s.url));
      return { d, snaps, pages, listings: LISTING_PAGES[d.id] ?? [] };
    })
    .filter((x) => x.d.website && (x.pages.length || x.listings.length));

  const prog: ScanProgress = { total: plans.reduce((n, x) => n + x.pages.length + x.listings.length, 0), done: 0, dealer: null };
  const tick = (dealer: string, more = 0) => {
    prog.total += more;
    if (!more) prog.done++;
    prog.dealer = dealer;
    progress({ ...prog });
  };
  progress({ ...prog });

  const rows: PriceRow[] = [];
  const problems: ScanProblem[] = [];
  const found: ScanResult["found"] = [];

  await pool(plans, PARALLEL_DEALERS, async ({ d, snaps, listings }) => {
    const known = new Map(snaps.map((s) => [s.productId, s]));
    let first = true;
    const fetchPage = async (url: string) => {
      if (!first) await sleep(PAUSE_MS);
      first = false;
      const r = await get(url);
      tick(d.name);
      return r;
    };

    for (const s of snaps) {
      const p = byId.get(s.productId);
      if (!p) continue;
      if (!isActive.has(p.id) || !isPage(s.url)) {
        rows.push(carried(p.slug, d.id, s));
        continue;
      }
      const r = await fetchPage(s.url);
      if ("error" in r) {
        problems.push({ dealer: d.name, model: p.model, url: s.url, reason: r.error });
        rows.push(carried(p.slug, d.id, s));
      } else if (r.status === 404 || r.status === 410) {
        // The dealer took the product page down: the listing is dropped (shown as "Bỏ niêm yết")
      } else if (r.status >= 400) {
        problems.push({ dealer: d.name, model: p.model, url: s.url, reason: `HTTP ${r.status}` });
        rows.push(carried(p.slug, d.id, s));
      } else {
        const o = extractOffer(r.html);
        if (o.via === "none") {
          problems.push({ dealer: d.name, model: p.model, url: s.url, reason: "không đọc được giá trên trang" });
          rows.push(carried(p.slug, d.id, s));
        } else rows.push(freshRow(p.slug, d.id, s.url, o, s));
      }
    }

    // New listings: links on the category pages to active models this dealer has no row for
    const wanted = active.filter((p) => !known.has(p.id));
    if (!wanted.length) {
      for (let i = 0; i < listings.length; i++) tick(d.name);
      return;
    }
    const candidates = new Map<number, string>();
    for (const url of listings) {
      const r = await fetchPage(url);
      if ("error" in r || r.status >= 400) continue;
      for (const l of pageLinks(r.html, r.url)) {
        const id = matchLink(l.text, l.href, wanted);
        if (id && !candidates.has(id)) candidates.set(id, l.href);
      }
    }
    tick(d.name, candidates.size);
    for (const [id, url] of candidates) {
      const p = byId.get(id)!;
      const r = await fetchPage(url);
      if ("error" in r || r.status >= 400) continue;
      const o = extractOffer(r.html);
      // The page itself must name the model (a link text can mention several)
      if (o.via === "none" || !o.name || matchLink(o.name, r.url, wanted) !== id) continue;
      rows.push(freshRow(p.slug, d.id, r.url, o, undefined));
      found.push({ dealer: d.name, model: p.model, price: o.priceVnd });
    }
  });

  const day = isoDay(new Date());
  const covered: DealerInfo[] = plans.map(({ d }) => ({ id: d.id, name: d.name, website: d.website, status: d.status, note: d.note }));
  const parsed: ParsedPriceFile = { format: "dealer-json", capturedAt: vnDate(day), dealers: covered, rows, warnings: [] };
  const plan = await buildPlan(prisma, parsed, vnDate(day)!);
  const importId = plan.snapshots.length
    ? await applyPlan(prisma, plan, { source: "crawl", fileName: `Quét giá tự động · ${covered.length} đại lý`, uploadedById: userId })
    : null;

  return {
    importId,
    day,
    dealers: covered.length,
    pages: prog.done,
    counts: { price: plan.counts.price, new: plan.counts.new, removed: plan.counts.removed, stock: plan.counts.stock, same: plan.counts.same },
    found: found.sort((a, b) => a.model.localeCompare(b.model)),
    problems: problems.sort((a, b) => a.dealer.localeCompare(b.dealer) || a.model.localeCompare(b.model)),
    stale: [...stale]
      .map(([id, d]) => ({ model: byId.get(id)?.model ?? String(id), lastSale: isoDay(d), hidden: byId.get(id)?.hidden }))
      .filter((x) => !x.hidden)
      .map(({ model, lastSale }) => ({ model, lastSale })),
    sellOut: !!sellOut,
  };
}
