// Reads the price of one product page from a dealer site. Pure (tested in extract.test.ts), no network.
// Order: schema.org JSON-LD Product -> og/product meta -> microdata -> a few site patterns.
import { parseVnd } from "../normalize";

export type Availability = "in_stock" | "out_of_stock" | "preorder" | "discontinued" | null;

export type PageOffer = {
  priceVnd: number | null; // null = no price on the page ("Liên hệ")
  listPriceVnd: number | null;
  availability: Availability;
  name: string | null;
  via: "ld" | "meta" | "microdata" | "site" | "none";
};

/** Haravan / Shopify themes print prices x100 ("1499000000" for 14.990.000 đ) */
function vnd(v: unknown): number | null {
  const n = typeof v === "number" ? Math.round(v) : parseVnd(typeof v === "string" ? v.replace(/[.,]00$/, "") : v);
  if (n === null) return null;
  if (n >= 300_000_000 && n % 100 === 0) return n / 100;
  return n >= 50_000 ? n : null; // a few thousand đ is a placeholder, not a monitor price
}

function availability(v: unknown): Availability {
  const s = String(v ?? "").toLowerCase();
  if (/instock|limitedavailability|instoreonly|onlineonly/.test(s)) return "in_stock";
  if (/outofstock|soldout/.test(s)) return "out_of_stock";
  if (/preorder|presale|backorder/.test(s)) return "preorder";
  if (/discontinued/.test(s)) return "discontinued";
  return null;
}

const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** JSON-LD as sites write it: raw line breaks inside strings, `//` comment lines, trailing commas */
function parseLoose(text: string): unknown {
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch {
    try {
      const fixed = t
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/[\u0000-\u001f]+/g, " ")
        .replace(/,\s*([}\]])/g, "$1");
      return JSON.parse(fixed);
    } catch {
      return null;
    }
  }
}

type LdProduct = { name?: unknown; offers?: unknown };

function ldProducts(html: string): LdProduct[] {
  const out: LdProduct[] = [];
  const walk = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(walk);
    const r = o as Record<string, unknown>;
    const types = ([] as unknown[]).concat(r["@type"] ?? []).map(String);
    if (types.includes("Product") || types.includes("ProductGroup")) out.push(r);
    if (r["@graph"]) walk(r["@graph"]);
    if (r.mainEntity) walk(r.mainEntity);
  };
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) walk(parseLoose(m[1]));
  return out;
}

function fromLd(html: string): PageOffer | null {
  for (const p of ldProducts(html)) {
    const offers = ([] as unknown[]).concat(p.offers ?? []).filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
    if (!offers.length) continue;
    const o = offers[0];
    const price = vnd(o.price ?? o.lowPrice ?? (o.priceSpecification as Record<string, unknown> | undefined)?.price);
    const high = vnd(o.highPrice);
    return {
      priceVnd: price,
      listPriceVnd: high && price && high > price ? high : null,
      availability: availability(o.availability),
      name: typeof p.name === "string" ? decode(p.name) : null,
      via: "ld",
    };
  }
  return null;
}

function metaContent(html: string, re: RegExp): string | null {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (re.test(m[0])) {
      const c = m[0].match(/content\s*=\s*["']([^"']*)["']/i);
      if (c) return c[1];
    }
  }
  return null;
}

function fromMeta(html: string): PageOffer | null {
  const price = metaContent(html, /(property|name|itemprop)\s*=\s*["'](product:price:amount|og:price:amount)["']/i);
  if (price === null) return null;
  const avail = metaContent(html, /(property|name)\s*=\s*["'](product:availability|og:availability)["']/i);
  return { priceVnd: vnd(price), listPriceVnd: null, availability: availability(avail?.replace(/\s/g, "")), name: null, via: "meta" };
}

function fromMicrodata(html: string): PageOffer | null {
  const p = html.match(/itemprop\s*=\s*["']price["'][^>]*content\s*=\s*["']([^"']+)["']|content\s*=\s*["']([^"']+)["'][^>]*itemprop\s*=\s*["']price["']/i);
  if (!p) return null;
  const a = html.match(/itemprop\s*=\s*["']availability["'][^>]*(?:href|content)\s*=\s*["']([^"']+)["']/i);
  return { priceVnd: vnd(p[1] ?? p[2]), listPriceVnd: null, availability: availability(a?.[1]), name: null, via: "microdata" };
}

/** Site patterns for pages without structured data (pcmarket.vn) */
function fromSite(html: string): PageOffer | null {
  const pcm = html.match(/id=["']js-pd-combo-product-main-price["'][^>]*value=["'](\d+)["']/i);
  if (pcm) return { priceVnd: vnd(pcm[1]), listPriceVnd: null, availability: null, name: null, via: "site" };
  return null;
}

/**
 * FPT Shop's JSON-LD carries the list price; the price customers pay is the "finalPrice" next to it in the page data.
 * Applied only when that list price is found right before a finalPrice.
 */
function finalPrice(html: string, listed: number): number | null {
  const re = new RegExp(`\\\\?"price\\\\?":${listed},\\\\?"discount\\\\?":\\d+,\\\\?"finalPrice\\\\?":(\\d+)`);
  const m = html.match(re);
  const n = m ? Number(m[1]) : NaN;
  return n > 0 && n < listed ? n : null;
}

const STOP_BADGE = /class=["'][^"']*(stop|ngung|status)[^"']*["'][^>]*>\s*(ngừng kinh doanh|ngừng bán|ngưng kinh doanh)/i;

/** Reads the offer of a product page; `via: "none"` when nothing usable was found */
export function extractOffer(html: string): PageOffer {
  const found = fromLd(html) ?? fromMeta(html) ?? fromMicrodata(html) ?? fromSite(html);
  if (!found) return { priceVnd: null, listPriceVnd: null, availability: null, name: null, via: "none" };
  const offer = { ...found };
  if (offer.priceVnd !== null) {
    const fin = finalPrice(html, offer.priceVnd);
    if (fin) {
      offer.listPriceVnd = offer.priceVnd;
      offer.priceVnd = fin;
    }
  }
  if (!offer.name) {
    const t = metaContent(html, /property\s*=\s*["']og:title["']/i) ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? null;
    offer.name = t ? decode(t) : null;
  }
  // A product page that says it is discontinued, without structured stock info
  if (offer.availability === null) {
    const body = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
    const main = body.slice(0, Math.min(body.length, 400_000));
    // Only a status element counts: the words alone also appear in menus and policy text
    if (STOP_BADGE.test(main)) offer.availability = "discontinued";
  }
  return offer;
}

/** The note the price import understands (classifyStock): stock words in Vietnamese */
export function offerNote(o: PageOffer): string | null {
  if (o.availability === "discontinued") return "Ngừng kinh doanh";
  if (o.availability === "out_of_stock") return "Hết hàng";
  if (o.availability === "preorder") return "Hàng sắp về";
  if (o.priceVnd === null) return "Liên hệ";
  if (o.availability === "in_stock") return "Còn hàng";
  return null;
}
