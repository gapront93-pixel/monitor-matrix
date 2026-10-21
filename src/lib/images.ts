import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp, { type Metadata } from "sharp";

import { IMPORT_VI, type ImportMessages } from "./i18n/messages/import";
import { isPublicHttpUrl, modelKey } from "./image-names";
export { imageUrls } from "./image-names";
import { normKey } from "./normalize";
import { prisma } from "./prisma";

/** Outside the build folders, so deploys never touch it */
export const IMAGE_DIR = process.env.IMAGE_DIR ?? path.join(process.cwd(), "storage", "images");

const MAIN = 1200; // px, longest side
const THUMB = 360;
const MAX_INPUT_BYTES = 12 * 1024 * 1024;
const MIN_SIDE = 240; // smaller is a logo or an icon, not a product photo
const MAX_PIXELS = 40_000_000; // decoding a bigger picture would need hundreds of MB on this 2GB server

// Every photo is processed once, so the libvips cache only holds memory (PM2 restarts the app above 400MB)
sharp.cache(false);

export class ImageError extends Error {}

type ImgMessages = ImportMessages["images"];

function fileBase(slug: string): string {
  return slug.replace(/[^A-Za-z0-9_-]/g, "_");
}

/** Resize, convert to WebP and store as <slug>.webp + <slug>-thumb.webp; records the source on the product */
export async function saveProductImage(
  productId: number,
  slug: string,
  input: Buffer,
  source: { kind: "upload" | "link" | `dealer:${string}` | `gigabyte:${string}` | "maker"; url?: string | null },
  m: ImgMessages = IMPORT_VI.images,
): Promise<void> {
  if (input.length > MAX_INPUT_BYTES) throw new ImageError(m.tooBig);
  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: false }).metadata(); // header only, nothing is decoded
  } catch {
    throw new ImageError(m.notImage);
  }
  if (!meta.width || !meta.height) throw new ImageError(m.noSize);
  if (meta.width * meta.height > MAX_PIXELS) throw new ImageError(m.tooManyPixels(meta.width, meta.height));
  if (Math.max(meta.width, meta.height) < MIN_SIDE) throw new ImageError(m.tooSmall(meta.width, meta.height, MIN_SIDE));

  const base = fileBase(slug);
  await mkdir(IMAGE_DIR, { recursive: true });
  // The original is decoded once; the thumbnail is made from the much smaller main photo
  const main = await sharp(input, { failOn: "none", limitInputPixels: MAX_PIXELS })
    .rotate() // honour EXIF orientation
    .resize(MAIN, MAIN, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  const thumb = await sharp(main).resize(THUMB, THUMB, { fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
  await Promise.all([writeFile(path.join(IMAGE_DIR, `${base}.webp`), main), writeFile(path.join(IMAGE_DIR, `${base}-thumb.webp`), thumb)]);
  await prisma.product.update({
    where: { id: productId },
    data: { imageFile: `${base}.webp`, imageSource: source.kind, imageSourceUrl: source.url ?? null, imageUpdatedAt: new Date() },
  });
}

export async function deleteProductImage(productId: number): Promise<void> {
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { imageFile: true } });
  if (p?.imageFile) {
    const base = p.imageFile.replace(/\.webp$/, "");
    await Promise.all([rm(path.join(IMAGE_DIR, `${base}.webp`), { force: true }), rm(path.join(IMAGE_DIR, `${base}-thumb.webp`), { force: true })]);
  }
  await prisma.product.update({ where: { id: productId }, data: { imageFile: null, imageSource: null, imageSourceUrl: null, imageUpdatedAt: null } });
}

/** /images/<file>: only names this module writes */
export async function readStoredImage(file: string): Promise<Buffer | null> {
  if (!/^[A-Za-z0-9_-]+(-thumb)?\.webp$/.test(file)) return null;
  try {
    return await readFile(path.join(IMAGE_DIR, file));
  } catch {
    return null;
  }
}

// --- Auto fetch from dealer pages ---

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

// Dealers whose product photos are usually the official renders, tried first
export const DEALER_PRIORITY = [
  "tgdd", "dienmayxanh", "fptshop", "gearvn", "hacom", "phucanh", "ankhang", "cellphones", "memoryzone", "xgear",
  "kccshop", "nguyencong", "ngoisao", "hoanghapc", "hoangha", "songphuong", "tandoanh", "minhan", "thinkpro",
  "hangchinhhieu", "pcm", "vietxue", "triviet", "lehuy", "tnc", "hotgear",
];

export async function fetchLimited(url: string, maxBytes: number, accept: string, m: ImgMessages = IMPORT_VI.images): Promise<{ body: Buffer; type: string; finalUrl: string }> {
  if (!isPublicHttpUrl(url)) throw new ImageError(m.badUrl);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15_000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "vi,en;q=0.8" }, redirect: "follow", signal: ctl.signal });
    if (!res.ok) throw new ImageError(m.http(res.status));
    if (res.url && !isPublicHttpUrl(res.url)) throw new ImageError(m.badUrl);
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > maxBytes) throw new ImageError(m.fileTooBig);
    // Read in chunks and stop at maxBytes, so a server that sends no length cannot fill the memory
    const chunks: Buffer[] = [];
    let size = 0;
    const reader = res.body?.getReader();
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        ctl.abort();
        throw new ImageError(m.fileTooBig);
      }
      chunks.push(Buffer.from(value));
    }
    const body = Buffer.concat(chunks, size);
    return { body, type: res.headers.get("content-type") ?? "", finalUrl: res.url || url };
  } catch (e) {
    if (e instanceof ImageError) throw e;
    throw new ImageError(ctl.signal.aborted ? m.timeout : m.offline);
  } finally {
    clearTimeout(timer);
  }
}

function metaContent(html: string, key: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag?.match(/content=["']([^"']+)["']/i)?.[1]?.replace(/&amp;/g, "&") ?? null;
}

export type FetchResult = { ok: true; source: string; url: string } | { ok: false; error: string };

/** Product renders hosted by GIGABYTE itself (static.gigabyte.com is reachable from the server, gigabyte.com is not) */
function officialImages(html: string): string[] {
  const found = html.match(/https?:\/\/static\.gigabyte\.com\/StaticFile\/Image\/Global\/[A-Za-z0-9/_.-]+?\.(?:png|jpe?g|webp)/gi) ?? [];
  return [...new Set(found)].filter((u) => !/(logo|icon|banner|award)/i.test(u));
}

/**
 * Tries the dealer product pages of a model in DEALER_PRIORITY order and keeps a page only when its title
 * names the model (so a category page or a shop logo is never used). An official GIGABYTE render found in
 * any of those pages wins over the dealer's own og:image photo.
 */
export async function autoFetchImage(
  product: { id: number; slug: string; model: string; isGigabyte: boolean; url: string | null },
  m: ImgMessages = IMPORT_VI.images,
): Promise<FetchResult> {
  const snaps = await prisma.priceSnapshot.findMany({
    where: { productId: product.id, url: { startsWith: "http" } },
    orderBy: { capturedAt: "desc" },
    select: { dealerId: true, url: true },
  });
  const pages = new Map<string, string>();
  for (const s of snaps) if (!pages.has(s.dealerId) && s.url && !/\.pdf($|\?)/i.test(s.url)) pages.set(s.dealerId, s.url);
  const candidates = [...pages.entries()].sort((a, b) => (DEALER_PRIORITY.indexOf(a[0]) + 1 || 99) - (DEALER_PRIORITY.indexOf(b[0]) + 1 || 99));
  // Rivals have no Vietnamese dealer pages: the maker's spec page (ASUS/ROG, Samsung, Dell answer; MSI and lg.com/us block servers)
  if (!product.isGigabyte && product.url) candidates.unshift(["maker", product.url]);
  if (!candidates.length) return { ok: false, error: m.noPages };

  const key = modelKey(product.model);
  const tried: string[] = [];
  let fallback: { dealerId: string; pageUrl: string; imgUrl: string } | null = null;
  const save = async (dealerId: string, pageUrl: string, imgUrl: string, official: boolean) => {
    const img = await fetchLimited(imgUrl, 10 * 1024 * 1024, "image/*", m);
    if (!/^image\//.test(img.type)) throw new ImageError(m.notAnImage);
    const kind = dealerId === "maker" ? "maker" : official ? (`gigabyte:${dealerId}` as const) : (`dealer:${dealerId}` as const);
    await saveProductImage(product.id, product.slug, img.body, { kind, url: pageUrl }, m);
    return { ok: true as const, source: kind, url: pageUrl };
  };

  for (const [dealerId, pageUrl] of candidates.slice(0, 6)) {
    try {
      const page = await fetchLimited(pageUrl, 3 * 1024 * 1024, "text/html", m);
      const html = page.body.toString("utf8");
      const title = `${metaContent(html, "og:title") ?? ""} ${html.match(/<title[^>]*>([^<]*)/i)?.[1] ?? ""}`;
      if (!normKey(title).includes(key)) {
        tried.push(`${dealerId}: ${m.wrongPage}`);
        continue;
      }
      if (product.isGigabyte) {
        for (const official of officialImages(html).slice(0, 2)) {
          try {
            return await save(dealerId, pageUrl, official, true);
          } catch {
            // a broken or tiny official file: try the next one, then the dealer photo
          }
        }
      }
      const og = metaContent(html, "og:image") ?? metaContent(html, "twitter:image");
      if (!og) {
        tried.push(`${dealerId}: ${m.noOg}`);
        continue;
      }
      // Keep the first dealer photo, but keep looking for an official render on the next pages
      fallback ??= { dealerId, pageUrl, imgUrl: new URL(og, page.finalUrl).toString() };
      if (!product.isGigabyte) break;
    } catch (e) {
      tried.push(`${dealerId}: ${e instanceof Error ? e.message : m.error}`);
    }
  }
  if (fallback) {
    try {
      return await save(fallback.dealerId, fallback.pageUrl, fallback.imgUrl, false);
    } catch (e) {
      tried.push(`${fallback.dealerId}: ${e instanceof Error ? e.message : m.error}`);
    }
  }
  return { ok: false, error: tried.join(" · ") };
}

/** A pasted image link (e.g. copied from gigabyte.com in your own browser): downloaded by the server */
export async function imageFromLink(product: { id: number; slug: string }, url: string, m: ImgMessages = IMPORT_VI.images): Promise<void> {
  const img = await fetchLimited(url, 12 * 1024 * 1024, "image/*", m);
  if (!/^image\//.test(img.type)) throw new ImageError(m.notAnImage);
  await saveProductImage(product.id, product.slug, img.body, { kind: "link", url }, m);
}
