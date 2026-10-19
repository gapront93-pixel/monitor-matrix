import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp, { type Metadata } from "sharp";

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

export class ImageError extends Error {}

function fileBase(slug: string): string {
  return slug.replace(/[^A-Za-z0-9_-]/g, "_");
}

/** Resize, convert to WebP and store as <slug>.webp + <slug>-thumb.webp; records the source on the product */
export async function saveProductImage(
  productId: number,
  slug: string,
  input: Buffer,
  source: { kind: "upload" | `dealer:${string}` | "maker"; url?: string | null },
): Promise<void> {
  if (input.length > MAX_INPUT_BYTES) throw new ImageError("Ảnh lớn hơn 12 MB.");
  let meta: Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new ImageError("File không phải ảnh hoặc ảnh bị hỏng.");
  }
  if (!meta.width || !meta.height) throw new ImageError("Không đọc được kích thước ảnh.");
  if (Math.max(meta.width, meta.height) < MIN_SIDE) throw new ImageError(`Ảnh quá nhỏ (${meta.width}×${meta.height}px), cần ít nhất ${MIN_SIDE}px.`);

  const base = fileBase(slug);
  await mkdir(IMAGE_DIR, { recursive: true });
  const img = sharp(input, { failOn: "none" }).rotate(); // honour EXIF orientation
  const [main, thumb] = await Promise.all([
    img.clone().resize(MAIN, MAIN, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
    img.clone().resize(THUMB, THUMB, { fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer(),
  ]);
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

/** /anh/<file>: only names this module writes */
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

async function fetchLimited(url: string, maxBytes: number, accept: string): Promise<{ body: Buffer; type: string; finalUrl: string }> {
  if (!isPublicHttpUrl(url)) throw new ImageError("địa chỉ không hợp lệ");
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15_000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "vi,en;q=0.8" }, redirect: "follow", signal: ctl.signal });
    if (!res.ok) throw new ImageError(`trang trả lỗi ${res.status}`);
    if (res.url && !isPublicHttpUrl(res.url)) throw new ImageError("địa chỉ không hợp lệ");
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > maxBytes) throw new ImageError("tệp quá lớn");
    const body = Buffer.from(await res.arrayBuffer());
    if (body.length > maxBytes) throw new ImageError("tệp quá lớn");
    return { body, type: res.headers.get("content-type") ?? "", finalUrl: res.url || url };
  } catch (e) {
    if (e instanceof ImageError) throw e;
    throw new ImageError(ctl.signal.aborted ? "hết thời gian chờ" : "không kết nối được");
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

/**
 * Tries the dealer product pages of a model in DEALER_PRIORITY order: takes og:image when the page title
 * names the model (so a category page or a shop logo is never used).
 */
export async function autoFetchImage(product: { id: number; slug: string; model: string; isGigabyte: boolean; url: string | null }): Promise<FetchResult> {
  const snaps = await prisma.priceSnapshot.findMany({
    where: { productId: product.id, url: { startsWith: "http" } },
    orderBy: { capturedAt: "desc" },
    select: { dealerId: true, url: true },
  });
  const pages = new Map<string, string>();
  for (const s of snaps) if (!pages.has(s.dealerId) && s.url && !/\.pdf($|\?)/i.test(s.url)) pages.set(s.dealerId, s.url);
  const candidates = [...pages.entries()].sort((a, b) => (DEALER_PRIORITY.indexOf(a[0]) + 1 || 99) - (DEALER_PRIORITY.indexOf(b[0]) + 1 || 99));
  // Rivals have no Vietnamese dealer pages: try the maker's spec page
  if (!product.isGigabyte && product.url) candidates.push(["maker", product.url]);
  if (!candidates.length) return { ok: false, error: "Chưa có trang đại lý nào cho mẫu này" };

  const key = modelKey(product.model);
  const tried: string[] = [];
  for (const [dealerId, pageUrl] of candidates.slice(0, 6)) {
    try {
      const page = await fetchLimited(pageUrl, 3 * 1024 * 1024, "text/html");
      const html = page.body.toString("utf8");
      const title = `${metaContent(html, "og:title") ?? ""} ${html.match(/<title[^>]*>([^<]*)/i)?.[1] ?? ""}`;
      if (!normKey(title).includes(key)) {
        tried.push(`${dealerId}: trang không đúng mẫu`);
        continue;
      }
      const og = metaContent(html, "og:image") ?? metaContent(html, "twitter:image");
      if (!og) {
        tried.push(`${dealerId}: không có ảnh`);
        continue;
      }
      const imgUrl = new URL(og, page.finalUrl).toString();
      const img = await fetchLimited(imgUrl, 10 * 1024 * 1024, "image/*");
      if (!/^image\//.test(img.type)) {
        tried.push(`${dealerId}: không phải ảnh`);
        continue;
      }
      await saveProductImage(product.id, product.slug, img.body, { kind: dealerId === "maker" ? "maker" : `dealer:${dealerId}`, url: pageUrl });
      return { ok: true, source: dealerId, url: pageUrl };
    } catch (e) {
      tried.push(`${dealerId}: ${e instanceof Error ? e.message : "lỗi"}`);
    }
  }
  return { ok: false, error: tried.join(" · ") };
}
