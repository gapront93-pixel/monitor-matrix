// Loads everything under data/ into the database. Safe to run again: rows are upserted on their natural keys,
// the seed price import is replaced, and admin settings (dealer order, key flag, price type) are kept.
// Usage: npm run seed            (DATA_DIR=/path/to/data to read another folder)
import "dotenv/config";

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { applyPlan, buildPlan, productIndex } from "../src/lib/import/plan";
import { parseDealerJson, vnDate, type ParsedPriceFile } from "../src/lib/import/prices";
import { cleanStr, codeTokens, normKey, stripParens, benchNum } from "../src/lib/normalize";
import { prisma } from "../src/lib/prisma";

import { competitorData, gigabyteData, slugify, type GigabyteSpec, type SegmentFile } from "./catalog-data";
import { applyLineup } from "./lineup";

const DATA = process.env.DATA_DIR ?? path.join(__dirname, "..", "data");
const readJson = <T>(...p: string[]): T => JSON.parse(readFileSync(path.join(DATA, ...p), "utf8").replace(/^\uFEFF/, ""));

// Order of "Kết luận nhanh theo phân khúc" in TOM-TAT-SO-SANH.md
const SEGMENT_ORDER = [
  "oled27-qhd-240-280",
  "oled27-qhd-360-500",
  "oled32-4k-240",
  "oled34-uwqhd",
  "ips27-qhd-180-300",
  "ips27-4k-160",
  "fhd-esports-24-27",
  "va34-uwqhd-curved",
];

// Card titles and verdict tags (from TOM-TAT-SO-SANH.md). The verdict is only set when the segment is new: the admin owns it after that
const SEGMENT_META: Record<string, { shortName: string; verdict: "lead" | "even" | "weak" }> = {
  "oled27-qhd-240-280": { shortName: 'OLED 27" QHD 240–280Hz', verdict: "lead" },
  "oled27-qhd-360-500": { shortName: 'OLED 27" QHD 360–500Hz', verdict: "even" },
  "oled32-4k-240": { shortName: 'OLED 32" 4K 240Hz', verdict: "even" },
  "oled34-uwqhd": { shortName: 'OLED 34" Ultrawide', verdict: "even" },
  "ips27-qhd-180-300": { shortName: 'IPS 27" QHD 180–300Hz', verdict: "even" },
  "ips27-4k-160": { shortName: 'IPS 27" 4K 144–160Hz', verdict: "even" },
  "fhd-esports-24-27": { shortName: 'FHD eSports 24–27"', verdict: "weak" },
  "va34-uwqhd-curved": { shortName: 'VA 34" Ultrawide cong', verdict: "lead" },
};

// Names in segments/*.json that differ from the slug in gigabyte-specs.json
const SEGMENT_MODEL_ALIASES: Record<string, string[]> = {
  "m27q2-qd": ["M27Q2"],
  "aorus-elite-fo32u24g": ["FO32U24G"],
  g34wqcp: ["G34WQCP-rev-10", "G34WQCP-rev-20"],
};

// Column order and key dealers of the approved price table; the rest follow
const KEY_DEALERS = [
  "nguyencong", "ngoisao", "fptshop", "hotgear", "lephung", "triviet", "tgdd", "dienmayxanh",
  "hoanghapc", "hacom", "nguyenkim", "xgear", "vietxue", "lehuy", "pcm",
];
const OTHER_DEALERS = [
  "gearvn", "hangchinhhieu", "cellphones", "memoryzone", "hoangha", "phucanh", "ankhang", "tnc",
  "minhan", "tandoanh", "kccshop", "songphuong", "thinkpro",
];
const WHOLESALE = new Set(["lephung"]);
const VERDICT_ONLY = "Nhận xét";

function conclusions(): Map<string, string> {
  const out = new Map<string, string>();
  let md = "";
  try {
    md = readFileSync(path.join(DATA, "TOM-TAT-SO-SANH.md"), "utf8");
  } catch {
    return out;
  }
  const part = md.split(/^## /m).find((s) => s.startsWith("Kết luận")) ?? "";
  for (const m of part.matchAll(/^(\d+)\.\s+\*\*(.+?)\*\*\s*(.+)$/gm)) {
    const id = SEGMENT_ORDER[Number(m[1]) - 1];
    if (id) out.set(id, m[3].trim());
  }
  return out;
}

async function main() {
  const t0 = Date.now();
  const warn: string[] = [];
  const conc = conclusions();

  // --- Segments ---
  const segFiles = readdirSync(path.join(DATA, "segments")).filter((f) => f.endsWith(".json"));
  const segments = segFiles.map((f) => readJson<SegmentFile>("segments", f));
  for (const s of segments) {
    const order = SEGMENT_ORDER.indexOf(s.segment_id);
    const data = {
      nameVi: s.segment_name_vi,
      criteria: s.criteria,
      conclusionVi: conc.get(s.segment_id) ?? null,
      notes: cleanStr(s.notes),
      sortOrder: order >= 0 ? order + 1 : 100,
    };
    const meta = SEGMENT_META[s.segment_id];
    // Conclusion and verdict are only set when the segment is new: the admin owns them after that
    // (the 2026 lineup changed the rivals, so the original texts were cleared there on purpose)
    const { conclusionVi, ...rest } = data;
    await prisma.segment.upsert({
      where: { id: s.segment_id },
      create: { id: s.segment_id, ...data, shortName: meta?.shortName ?? null, verdict: meta?.verdict ?? null },
      update: { ...rest, shortName: meta?.shortName ?? null },
    });
    void conclusionVi;
  }

  // --- GIGABYTE products ---
  const specs = readJson<GigabyteSpec[]>("gigabyte-specs.json");
  const bySlug = new Map(specs.map((x) => [x.slug.toLowerCase(), x.slug]));
  const segOf = new Map<string, string>(); // GIGABYTE slug -> segment
  const extraAliases = new Map<string, string[]>();
  for (const s of segments) {
    for (const name of s.gigabyte_models) {
      const targets = bySlug.has(name.toLowerCase()) ? [bySlug.get(name.toLowerCase())!] : (SEGMENT_MODEL_ALIASES[name] ?? []);
      if (!targets.length) warn.push(`Phân khúc ${s.segment_id}: không tìm thấy mẫu "${name}"`);
      for (const slug of targets) {
        segOf.set(slug, s.segment_id);
        if (slug.toLowerCase() !== name.toLowerCase()) extraAliases.set(slug, [...(extraAliases.get(slug) ?? []), normKey(name)]);
      }
    }
  }
  const existingAliases = new Map(
    (await prisma.product.findMany({ select: { slug: true, aliases: true } })).map((p) => [p.slug, p.aliases]),
  );
  const mergeAliases = (slug: string, add: string[]) => [...new Set([...(existingAliases.get(slug) ?? []), ...add])];

  for (const x of specs) {
    const data = { ...gigabyteData(x), segmentId: segOf.get(x.slug) ?? null, aliases: mergeAliases(x.slug, extraAliases.get(x.slug) ?? []) };
    await prisma.product.upsert({ where: { slug: x.slug }, create: { slug: x.slug, ...data }, update: data });
  }

  // --- Competitors ---
  let competitors = 0;
  for (const s of segments) {
    for (const c of s.competitors) {
      const data = competitorData(c, s.segment_id);
      const slug = slugify(`${data.brand} ${data.model}`);
      const aliases = mergeAliases(slug, [normKey(c.model), ...codeTokens(c.model)]);
      await prisma.product.upsert({ where: { slug }, create: { slug, ...data, aliases }, update: { ...data, aliases } });
      competitors++;
    }
  }

  // --- Benchmarks ---
  const products = await prisma.product.findMany({ select: { id: true, slug: true, model: true, aliases: true, isGigabyte: true, segmentId: true, rawSpecs: true } });
  const idx = productIndex(products);
  const rivals = products
    .filter((p) => !p.isGigabyte)
    .map((p) => ({ ...p, tokens: codeTokens(`${p.model} ${(p.rawSpecs as { _model_full?: string })._model_full ?? ""}`) }));

  const matchBench = (brand: string, subject: string, segmentId: string): number | null => {
    // Reviews comparing several monitors stay on the segment only
    if (/\bvs\.?\b|\bgroup\b/i.test(subject) || / \/ /.test(brand)) return null;
    const first = stripParens(subject).split(/\s+\/\s+/)[0];
    const exact = idx.get(normKey(first));
    if (exact?.length === 1) return exact[0];
    if (exact && exact.length > 1) return null;
    if (brand.toUpperCase().startsWith("GIGABYTE")) return null; // never borrow a sibling model's numbers
    const toks = codeTokens(first);
    const hit = (list: typeof rivals) => list.filter((p) => toks.some((t) => p.tokens.includes(t)));
    const inSeg = hit(rivals.filter((p) => p.segmentId === segmentId));
    let found = inSeg.length ? inSeg : hit(rivals);
    // "PG32UCDM" also sits inside "PG32UCDM Gen3": prefer the model whose name ends with the subject's code
    if (found.length > 1) found = found.filter((p) => normKey(p.model).endsWith(toks.at(-1) ?? "\u0000"));
    return found.length === 1 ? found[0].id : null;
  };

  const keep = new Set<string>();
  let benchRows = 0;
  const unlinked = new Set<string>();
  for (const s of segments) {
    for (const b of s.benchmarks) {
      const productId = matchBench(b.brand, b.model, s.segment_id);
      if (!productId) unlinked.add(`${s.segment_id}: ${b.brand} | ${b.model}`);
      const dateText = cleanStr(b.date);
      const date = dateText && /^\d{4}-\d{2}-\d{2}$/.test(dateText) ? new Date(`${dateText}T00:00:00Z`) : null;
      // A review with only a verdict still gets one row, so its source link is kept
      const metrics = Object.keys(b.metrics).length ? Object.entries(b.metrics) : [[VERDICT_ONLY, ""] as const];
      for (const [metric, raw] of metrics) {
        const value = cleanStr(raw) ?? "";
        if (!value && metric !== VERDICT_ONLY) continue;
        const key = { segmentId: s.segment_id, subject: b.model, source: b.source, url: b.url, metric };
        keep.add(JSON.stringify(key));
        const data = { productId, date, dateText, value, valueNum: benchNum(value), verdict: cleanStr(b.verdict) };
        await prisma.benchmark.upsert({
          where: { segmentId_subject_source_url_metric: key },
          create: { ...key, ...data },
          update: data,
        });
        benchRows++;
      }
    }
  }
  // Rows that left the data files
  const all = await prisma.benchmark.findMany({ select: { id: true, segmentId: true, subject: true, source: true, url: true, metric: true } });
  const stale = all.filter((r) => !keep.has(JSON.stringify({ segmentId: r.segmentId, subject: r.subject, source: r.source, url: r.url, metric: r.metric })));
  if (stale.length) await prisma.benchmark.deleteMany({ where: { id: { in: stale.map((r) => r.id) } } });

  // --- Dealers and prices ---
  const priceFiles = readdirSync(path.join(DATA, "prices")).filter((f) => f.endsWith(".json")).sort();
  const merged: ParsedPriceFile = { format: "dealer-json", capturedAt: null, dealers: [], rows: [], warnings: [] };
  const itemCount = new Map<string, number>();
  for (const f of priceFiles) {
    const p = parseDealerJson(readFileSync(path.join(DATA, "prices", f), "utf8"));
    merged.dealers.push(...p.dealers);
    merged.rows.push(...p.rows);
    for (const d of p.dealers) itemCount.set(d.id, p.rows.filter((r) => r.dealerId === d.id).length);
    if (p.capturedAt && (!merged.capturedAt || p.capturedAt > merged.capturedAt)) merged.capturedAt = p.capturedAt;
  }
  const rest = merged.dealers
    .map((d) => d.id)
    .filter((id) => !KEY_DEALERS.includes(id) && !OTHER_DEALERS.includes(id))
    .sort();
  const order = [...KEY_DEALERS, ...OTHER_DEALERS, ...rest];
  for (const d of merged.dealers) {
    const visible = d.status === "ok" && (itemCount.get(d.id) ?? 0) > 0;
    await prisma.dealer.upsert({
      where: { id: d.id },
      create: {
        id: d.id,
        name: d.name,
        website: d.website,
        status: d.status,
        note: d.note,
        sortOrder: order.indexOf(d.id) + 1,
        isKey: KEY_DEALERS.includes(d.id),
        priceType: WHOLESALE.has(d.id) ? "dealer" : "retail",
        visible,
      },
      // Keep what the admin set (order, key flag, price type, visibility); refresh what the data file knows
      update: { website: d.website, status: d.status, note: d.note },
    });
  }

  await prisma.priceImport.deleteMany({ where: { source: "seed" } });
  const capturedAt = merged.capturedAt ?? vnDate(new Date().toISOString().slice(0, 10))!;
  const plan = await buildPlan(prisma, merged, capturedAt);
  const importId = await applyPlan(prisma, plan, { source: "seed", fileName: "data/prices/*.json" });

  // --- Current lineup: segments, models shown, rivals (the rest is hidden) ---
  const lineupWarn = await applyLineup(prisma, DATA);
  if (lineupWarn) warn.push(...lineupWarn);

  // --- Report ---
  const [nSeg, nGb, nComp, nBench, nBenchLinked, nDealer, nSnap, nUnm] = await Promise.all([
    prisma.segment.count(),
    prisma.product.count({ where: { isGigabyte: true } }),
    prisma.product.count({ where: { isGigabyte: false } }),
    prisma.benchmark.count(),
    prisma.benchmark.count({ where: { productId: { not: null } } }),
    prisma.dealer.count(),
    prisma.priceSnapshot.count(),
    prisma.unmatchedPrice.count(),
  ]);
  console.log(`Phân khúc: ${nSeg} (kết luận tiếng Việt: ${conc.size})`);
  console.log(`Sản phẩm: ${nGb} GIGABYTE + ${nComp} đối thủ (đọc ${specs.length} + ${competitors})`);
  console.log(`Benchmark: ${nBench} dòng số đo (${nBenchLinked} gắn với sản phẩm, đọc ${benchRows}, xoá ${stale.length} dòng cũ)`);
  console.log(`Đại lý: ${nDealer}`);
  console.log(
    `Giá: lần nhập #${importId} ngày ${capturedAt.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}, ${plan.snapshots.length} giá, ` +
      `${plan.counts.duplicates} tin trùng đã gộp, ${plan.unmatched.length} dòng chưa khớp (tổng snapshot trong DB: ${nSnap}, chưa khớp: ${nUnm})`,
  );
  if (warn.length) console.log("Cảnh báo:\n  " + warn.join("\n  "));
  if (process.env.SEED_VERBOSE) console.log("Benchmark chỉ gắn phân khúc:\n  " + [...unlinked].join("\n  "));
  console.log(`Xong sau ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
