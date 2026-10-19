import "server-only";

import { z } from "zod";

import { isoDay } from "./format";
import { importMessages, type ImportMessages } from "./i18n/messages/import";
import { getLocale } from "./i18n/server";
import { applyPlan, buildPlan, type ImportPlan } from "./import/plan";
import { parsePriceFile, vnDate, type ParsedPriceFile } from "./import/prices";
import { prisma } from "./prisma";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type PreviewItem = {
  kind: "up" | "down" | "new" | "removed" | "stock" | "error";
  model: string;
  slug: string | null;
  dealer: string;
  before: number | null;
  after: number | null;
  diff: number | null;
  pct: number | null;
  note: string | null;
};

export type UploadPreview = {
  fileName: string;
  size: number;
  format: ParsedPriceFile["format"];
  rows: number;
  day: string; // YYYY-MM-DD the prices are recorded for
  dayFromFile: boolean;
  previousDay: string | null;
  dealers: { id: string; name: string; isNew: boolean }[];
  counts: Record<PreviewItem["kind"] | "same", number>;
  items: PreviewItem[];
  applicable: number; // price rows that "Áp dụng" will write
  keepMissing: boolean;
};

const formSchema = (m: ImportMessages["upload"]) =>
  z.object({
    file: z.instanceof(File, { message: m.noFile }),
    ngay: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, m.badDate)
      .optional()
      .or(z.literal("").transform(() => undefined)),
  });

export class UploadError extends Error {}

/** Reads the form, parses the file and diffs it against today's prices. Nothing is written. */
export async function planUpload(form: FormData): Promise<{ plan: ImportPlan; parsed: ParsedPriceFile; preview: UploadPreview }> {
  const msgs = importMessages[await getLocale()];
  const m = msgs.upload;
  const f = formSchema(m).safeParse({ file: form.get("file"), ngay: form.get("ngay") ?? undefined });
  if (!f.success) throw new UploadError(f.error.issues[0]?.message ?? m.badForm);
  const { file, ngay } = f.data;
  if (file.size === 0) throw new UploadError(m.empty);
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError(m.tooBig);

  const dealers = await prisma.dealer.findMany({ select: { id: true, name: true } });
  let parsed: ParsedPriceFile;
  try {
    parsed = parsePriceFile(file.name, await file.text(), dealers, msgs.parse);
  } catch (e) {
    throw new UploadError(e instanceof Error ? e.message : m.unreadable);
  }
  if (!parsed.dealers.length) throw new UploadError(m.noDealers);

  const today = isoDay(new Date());
  const day = ngay ?? (parsed.capturedAt ? isoDay(parsed.capturedAt) : today);
  if (day > today) throw new UploadError(m.future);
  const keepMissing = form.get("giu-gia-cu") === "1";
  const plan = await buildPlan(prisma, parsed, vnDate(day)!, { keepMissing });

  const [products, previous] = await Promise.all([
    prisma.product.findMany({ select: { id: true, slug: true, model: true } }),
    prisma.priceImport.findFirst({
      where: { dealers: { some: { dealerId: { in: parsed.dealers.map((d) => d.id) } } } },
      orderBy: [{ capturedAt: "desc" }, { createdAt: "desc" }],
      select: { capturedAt: true },
    }),
  ]);
  const prod = new Map(products.map((p) => [p.id, p]));
  const dealerName = new Map([...dealers.map((d) => [d.id, d.name] as const), ...plan.newDealers.map((d) => [d.id, d.name] as const)]);

  const items: PreviewItem[] = [];
  const counts: UploadPreview["counts"] = { up: 0, down: 0, new: 0, removed: 0, stock: 0, same: 0, error: 0 };
  for (const c of plan.changes) {
    const before = c.before?.priceVnd ?? null;
    const after = c.after?.priceVnd ?? null;
    let kind: PreviewItem["kind"] | "same" = c.kind === "price" ? (before !== null && after !== null && after < before ? "down" : "up") : c.kind;
    // A price that appears or disappears ("Liên hệ" <-> a number) counts as a stock change
    if (c.kind === "price" && (before === null || after === null)) kind = "stock";
    counts[kind]++;
    if (kind === "same") continue;
    const p = prod.get(c.productId);
    const diff = before !== null && after !== null && after !== before ? after - before : null;
    items.push({
      kind,
      model: p?.model ?? String(c.productId),
      slug: p?.slug ?? null,
      dealer: dealerName.get(c.dealerId) ?? c.dealerId,
      before,
      after,
      diff,
      pct: diff !== null && before ? Math.round((diff / before) * 1000) / 10 : null,
      note:
        c.kind === "new"
          ? m.newListing
          : c.kind === "removed"
            ? m.removed
            : kind === "stock"
              ? `${m.stock[c.before?.stockStatus ?? "none"]} → ${m.stock[c.after?.stockStatus ?? "none"]}`
              : null,
    });
  }
  for (const u of plan.unmatched) {
    counts.error++;
    items.push({ kind: "error", model: u.nameOnSite, slug: null, dealer: dealerName.get(u.dealerId) ?? u.dealerId, before: null, after: u.priceVnd, diff: null, pct: null, note: m.skipped(u.reason.kind === "noCode" ? msgs.reason.noCode : msgs.reason[u.reason.kind](u.reason.value)) });
  }
  for (const w of plan.warnings) {
    counts.error++;
    items.push({ kind: "error", model: "", slug: null, dealer: "", before: null, after: null, diff: null, pct: null, note: w });
  }
  const order: Record<PreviewItem["kind"], number> = { error: 0, up: 1, down: 2, new: 3, stock: 4, removed: 5 };
  items.sort((a, b) => order[a.kind] - order[b.kind] || a.model.localeCompare(b.model) || a.dealer.localeCompare(b.dealer));

  return {
    plan,
    parsed,
    preview: {
      fileName: file.name,
      size: file.size,
      format: parsed.format,
      rows: parsed.rows.length,
      day,
      dayFromFile: !ngay && !!parsed.capturedAt,
      previousDay: previous ? isoDay(previous.capturedAt) : null,
      dealers: parsed.dealers.map((d) => ({ id: d.id, name: dealerName.get(d.id) ?? d.name, isNew: plan.newDealers.some((n) => n.id === d.id) })),
      counts,
      items,
      applicable: plan.snapshots.length,
      keepMissing,
    },
  };
}

export async function applyUpload(form: FormData, userId: number): Promise<{ importId: number; preview: UploadPreview }> {
  const { plan, preview } = await planUpload(form);
  if (!plan.snapshots.length) throw new UploadError(importMessages[await getLocale()].upload.nothing);
  const importId = await applyPlan(prisma, plan, { source: "admin", fileName: preview.fileName, uploadedById: userId });
  return { importId, preview };
}
