"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { userWith } from "@/lib/auth";
import type { Permission } from "@/lib/permissions";
import { adminMessages } from "@/lib/i18n/messages/admin";
import { getT } from "@/lib/i18n/server";
import { classifyStock } from "@/lib/import/prices";
import { normKey } from "@/lib/normalize";
import { prisma } from "@/lib/prisma";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

type M = (typeof adminMessages)["vi"]["actions"];
const t = async (): Promise<M> => (await getT(adminMessages)).actions;

async function guard(perm: Permission): Promise<ActionResult | null> {
  return (await userWith(perm)) ? null : { ok: false, error: (await t()).denied };
}

function done(message?: string): ActionResult {
  // Every screen reads dealers and prices, so refresh them all
  revalidatePath("/", "layout");
  return { ok: true, message };
}

const fail = (error: string): ActionResult => ({ ok: false, error });

// --- Dealers ---

const website = (m: M) =>
  z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v), m.websiteFormat)
    .optional();

const dealerPatch = (m: M) =>
  z.object({
    name: z.string().trim().min(1, m.dealerNameEmpty).max(80).optional(),
    website: website(m),
    isKey: z.boolean().optional(),
    priceType: z.enum(["retail", "dealer"]).optional(),
    visible: z.boolean().optional(),
  });

type DealerPatch = { name?: string; website?: string; isKey?: boolean; priceType?: "retail" | "dealer"; visible?: boolean };

export async function updateDealer(id: string, patch: DealerPatch): Promise<ActionResult> {
  const denied = await guard("dealers.edit");
  if (denied) return denied;
  const p = dealerPatch(await t()).safeParse(patch);
  if (!p.success) return fail(p.error.issues[0].message);
  const { website: site, ...rest } = p.data;
  await prisma.dealer.update({ where: { id }, data: { ...rest, ...(site !== undefined ? { website: site || null } : {}) } });
  return done();
}

/** Swap with the neighbour; order numbers are rewritten 1..n so they stay contiguous */
export async function moveDealer(id: string, dir: -1 | 1): Promise<ActionResult> {
  const denied = await guard("dealers.edit");
  if (denied) return denied;
  const all = await prisma.dealer.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true } });
  const i = all.findIndex((d) => d.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= all.length) return { ok: true };
  [all[i], all[j]] = [all[j], all[i]];
  await prisma.$transaction(all.map((d, k) => prisma.dealer.update({ where: { id: d.id }, data: { sortOrder: k + 1 } })));
  return done();
}

export async function addDealer(input: { name: string; website?: string }): Promise<ActionResult> {
  const denied = await guard("dealers.edit");
  if (denied) return denied;
  const m = await t();
  const p = z.object({ name: z.string().trim().min(1, m.dealerNameNeeded).max(80), website: website(m) }).safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const base = normKey(p.data.name) || "daily";
  let id = base;
  for (let n = 2; await prisma.dealer.findUnique({ where: { id } }); n++) id = `${base}${n}`;
  const max = await prisma.dealer.aggregate({ _max: { sortOrder: true } });
  await prisma.dealer.create({
    data: { id, name: p.data.name, website: p.data.website || null, sortOrder: (max._max.sortOrder ?? 0) + 1, status: "ok", visible: true },
  });
  return done(m.dealerAdded(p.data.name, id));
}

/** Only dealers without any price history can be deleted; the others are hidden instead */
export async function deleteDealer(id: string): Promise<ActionResult> {
  const denied = await guard("dealers.delete");
  if (denied) return denied;
  const m = await t();
  const used = await prisma.priceSnapshot.count({ where: { dealerId: id } });
  if (used) return fail(m.dealerUsed(used));
  await prisma.dealer.delete({ where: { id } });
  return done(m.dealerDeleted);
}

// --- Segments ---

const SegmentPatch = z.object({
  verdict: z.enum(["lead", "even", "weak"]).nullable().optional(),
  conclusionVi: z.string().trim().max(4000).optional(),
});

export async function updateSegment(id: string, patch: { verdict?: "lead" | "even" | "weak" | null; conclusionVi?: string }): Promise<ActionResult> {
  const denied = await guard("segments");
  if (denied) return denied;
  const p = SegmentPatch.safeParse(patch);
  if (!p.success) return fail(p.error.issues[0].message);
  await prisma.segment.update({ where: { id }, data: p.data });
  return done((await t()).segmentSaved);
}

// --- Unmatched price rows ---

/**
 * Teach the matcher that this dealer listing is `productId`: adds an alias for future uploads and
 * turns the stored unmatched rows with the same name into real prices.
 */
export async function mapUnmatched(unmatchedId: number, productId: number): Promise<ActionResult> {
  const denied = await guard("unmatched");
  if (denied) return denied;
  const [u, product] = await Promise.all([
    prisma.unmatchedPrice.findUnique({ where: { id: unmatchedId } }),
    prisma.product.findUnique({ where: { id: productId }, select: { id: true, model: true, aliases: true } }),
  ]);
  const m = await t();
  if (!u || !product) return fail(m.notFound);
  const keys = [normKey(u.nameOnSite), u.slugInFile ? normKey(u.slugInFile) : ""].filter(Boolean);
  const same = await prisma.unmatchedPrice.findMany({ where: { OR: [{ nameOnSite: u.nameOnSite }, ...(u.slugInFile ? [{ slugInFile: u.slugInFile }] : [])] } });

  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id: product.id }, data: { aliases: [...new Set([...product.aliases, ...keys])] } });
    await tx.priceSnapshot.createMany({
      skipDuplicates: true,
      data: same.map((r) => {
        // Older imports appended the match reason to the note; keep only the dealer's own note
        const note = r.note?.replace(/ · (Không có mẫu|Không có mã mẫu|"[^"]*" khớp nhiều mẫu).*$/, "") || null;
        return { importId: r.importId, productId: product.id, dealerId: r.dealerId, priceVnd: r.priceVnd, listPriceVnd: null, ...classifyStock(note, r.priceVnd), note, nameOnSite: r.nameOnSite, url: r.url, capturedAt: r.capturedAt };
      }),
    });
    await tx.unmatchedPrice.deleteMany({ where: { id: { in: same.map((r) => r.id) } } });
  });
  return done(m.mapped(u.nameOnSite, product.model));
}

export async function dismissUnmatched(unmatchedId: number): Promise<ActionResult> {
  const denied = await guard("unmatched");
  if (denied) return denied;
  const u = await prisma.unmatchedPrice.findUnique({ where: { id: unmatchedId } });
  if (u) await prisma.unmatchedPrice.deleteMany({ where: { nameOnSite: u.nameOnSite, dealerId: u.dealerId } });
  return done((await t()).dismissed);
}

// --- Imports ---

/** Undo an upload made from this screen (the seed import stays) */
export async function deleteImport(importId: number): Promise<ActionResult> {
  const denied = await guard("prices");
  if (denied) return denied;
  const imp = await prisma.priceImport.findUnique({ where: { id: importId }, select: { source: true } });
  const m = await t();
  if (!imp) return fail(m.importNotFound);
  if (imp.source !== "admin") return fail(m.importNotAdmin);
  await prisma.priceImport.delete({ where: { id: importId } });
  return done(m.importUndone);
}
