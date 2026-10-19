// Parsing helpers shared by the seed script and the admin price import. No server-only imports here: tsx runs this too.

/** Lowercase, alphanumerics only: "AORUS ELITE FO27Q28G" -> "aoruselitefo27q28g" */
export function normKey(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Model-code tokens (letters and digits, 5+ chars): "UltraGear 27GR93U-B" -> ["27gr93u"] */
export function codeTokens(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length >= 5 && /\d/.test(t) && /[a-z]/.test(t));
}

export function stripParens(s: string): string {
  return s.replace(/\s*\([^)]*\)/g, "").trim();
}

const EMPTY = new Set(["", "n/a", "na", "-", "none", "no", "not listed"]);

export function cleanStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s.toLowerCase() === "n/a" ? null : s;
}

/** First number in a value: "1,500" -> 1500, "~330 nits" -> 330. Null when the value says it is missing. */
export function firstNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = cleanStr(v);
  if (!s || EMPTY.has(s.toLowerCase()) || /^not listed|^no\b/i.test(s)) return null;
  const m = s.replace(/(\d),(\d{3})/g, "$1$2").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export function firstInt(v: unknown): number | null {
  const n = firstNum(v);
  return n === null ? null : Math.round(n);
}

export function yesNo(v: unknown): boolean | null {
  const s = cleanStr(v)?.toLowerCase();
  if (!s) return null;
  if (/^(yes|có|true|\d)/.test(s)) return true;
  if (/^(no|không|false|none)/.test(s)) return false;
  return null;
}

/** Panel family used for filters: "Tandem WOLED (...)" -> "WOLED", "Fast IPS" -> "IPS" */
export function panelFamily(v: unknown): string | null {
  const s = cleanStr(v);
  if (!s) return null;
  if (/qd-?oled/i.test(s)) return "QD-OLED";
  if (/w-?oled/i.test(s)) return "WOLED";
  if (/oled/i.test(s)) return "OLED";
  if (/\bva\b/i.test(s)) return "VA";
  if (/ips/i.test(s)) return "IPS";
  if (/\btn\b/i.test(s)) return "TN";
  return s;
}

export function resolutionOf(v: unknown): string | null {
  const m = cleanStr(v)?.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/i);
  return m ? `${m[1]}x${m[2]}` : null;
}

/** Highest "HDMI 2.1" / "DP 1.4" version mentioned in a ports string */
export function portVersion(ports: string | null, kind: "hdmi" | "dp"): string | null {
  if (!ports) return null;
  const re = kind === "hdmi" ? /HDMI\s*(\d\.\d)/gi : /(?:\bDP|DisplayPort)\s*(\d\.\d)/gi;
  const vs = [...ports.matchAll(re)].map((m) => m[1]);
  return vs.length ? vs.sort().at(-1)! : null;
}

/** Price cell from a CSV / JSON: 16490000, "16.490.000", "16,490,000 đ" -> 16490000 */
export function parseVnd(v: unknown): number | null {
  if (typeof v === "number") return v > 0 ? Math.round(v) : null;
  const s = cleanStr(v);
  if (!s) return null;
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return n > 0 && n < 2_000_000_000 ? n : null;
}

/** Benchmark value to a number when it is a plain measurement: "~330", "1220.4:1", "14 ms" */
export function benchNum(value: string): number | null {
  const s = value.trim();
  if (!/^[~≈<>]?\s*-?\d[\d,.]*\s*(%|ms|nits?|cd\/m2|:1|hz|w)?$/i.test(s)) return null;
  return firstNum(s);
}
