// Finds product links on a dealer's category page. Pure (tested in match.test.ts).
import { stripParens } from "../normalize";

export type MatchProduct = { id: number; model: string };

const words = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9]+/g) ?? [];
const isCode = (w: string) => w.length >= 4 && /\d/.test(w) && /[a-z]/.test(w);

/** "AORUS ELITE FO27Q28G" -> words ["aorus","elite","fo27q28g"]; codes ["fo27q28g"] */
function modelWords(model: string): { all: string[]; codes: string[] } {
  const all = words(stripParens(model)).filter((w) => w.length >= 2 || /\d/.test(w));
  return { all, codes: all.filter(isCode) };
}

/**
 * The product a link is about, from its text and URL: every word of the model must appear
 * ("M27UP ICE" needs "ice"), and the most specific model wins. Ties (revisions of one model) match nothing.
 */
export function matchLink(text: string, href: string, products: MatchProduct[]): number | null {
  let path = href;
  try {
    path = decodeURIComponent(new URL(href, "https://x").pathname);
  } catch {
    // keep the raw href
  }
  const have = new Set([...words(text), ...words(path)]);
  let best: { id: number; n: number } | null = null;
  let tie = false;
  for (const p of products) {
    const m = modelWords(p.model);
    if (!m.codes.length || !m.all.every((w) => have.has(w))) continue;
    if (!best || m.all.length > best.n) {
      best = { id: p.id, n: m.all.length };
      tie = false;
    } else if (m.all.length === best.n) tie = true;
  }
  return best && !tie ? best.id : null;
}

/** <a href="...">text</a> on a page, absolute URLs on the same site only */
export function pageLinks(html: string, pageUrl: string): { href: string; text: string }[] {
  const base = new URL(pageUrl);
  const host = base.hostname.replace(/^www\./, "");
  const out = new Map<string, string>();
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = m[1].match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href || /^(#|javascript:|mailto:|tel:)/i.test(href)) continue;
    let abs: URL;
    try {
      abs = new URL(href.replace(/&amp;/g, "&"), base);
    } catch {
      continue;
    }
    if (abs.hostname.replace(/^www\./, "") !== host) continue;
    abs.hash = "";
    const title = m[1].match(/title\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    const text = `${m[2].replace(/<[^>]+>/g, " ")} ${title}`.replace(/\s+/g, " ").trim();
    const key = abs.toString();
    out.set(key, `${out.get(key) ?? ""} ${text}`.trim());
  }
  return [...out].map(([href, text]) => ({ href, text }));
}
