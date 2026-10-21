// Pure helpers for product photos (tested in image-names.test.ts)
import { normKey } from "./normalize";

/** "MO27Q28G.jpg", "aorus-fo32u2p (1).png", "G27Q20_2.webp" -> product id (via the product index) */
export function matchFileName(name: string, idx: Map<string, number[]>): number | null {
  const stem = name.replace(/\.[a-z0-9]+$/i, "").replace(/\s*\(\d+\)$/, "");
  for (const candidate of [stem, stem.replace(/[-_ ]\d{1,2}$/, "")]) {
    const ids = idx.get(normKey(candidate));
    if (ids?.length === 1) return ids[0];
  }
  return null;
}

/** Longest letters+digits token of the model, the part a page title must contain: "AORUS FO32U2P" -> "fo32u2p" */
export function modelKey(model: string): string {
  const toks = (model.replace(/\([^)]*\)/g, "").match(/[A-Za-z0-9]+/g) ?? []).filter((t) => /\d/.test(t) && /[a-z]/i.test(t));
  return normKey(toks.sort((a, b) => b.length - a.length)[0] ?? model);
}

/** Only public http(s) hosts: a page or og:image pointing at the server itself or a private network is refused */
export function isPublicHttpUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return false;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return false;
  if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return false;
  return true;
}

/** Public URLs of a stored photo; ?v= changes on every new upload so browser caches never show an old photo */
export function imageUrls(p: { imageFile: string | null; imageUpdatedAt: Date | null }): { image: string | null; thumb: string | null } {
  if (!p.imageFile) return { image: null, thumb: null };
  const v = p.imageUpdatedAt ? `?v=${p.imageUpdatedAt.getTime().toString(36)}` : "";
  const base = p.imageFile.replace(/\.webp$/, "");
  return { image: `/images/${base}.webp${v}`, thumb: `/images/${base}-thumb.webp${v}` };
}
