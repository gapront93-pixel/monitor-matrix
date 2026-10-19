"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isAdmin } from "@/lib/auth";
import { classifyStock } from "@/lib/import/prices";
import { normKey } from "@/lib/normalize";
import { prisma } from "@/lib/prisma";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function guard(): Promise<ActionResult | null> {
  return (await isAdmin()) ? null : { ok: false, error: "Phiên Quản trị đã hết hạn. Đăng nhập lại." };
}

function done(message?: string): ActionResult {
  // Every screen reads dealers and prices, so refresh them all
  revalidatePath("/", "layout");
  return { ok: true, message };
}

const fail = (error: string): ActionResult => ({ ok: false, error });

// --- Dealers ---

const DealerPatch = z.object({
  name: z.string().trim().min(1, "Tên đại lý không được trống.").max(80).optional(),
  website: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v), "Website phải bắt đầu bằng http:// hoặc https://")
    .optional(),
  isKey: z.boolean().optional(),
  priceType: z.enum(["retail", "dealer"]).optional(),
  visible: z.boolean().optional(),
});

export async function updateDealer(id: string, patch: z.input<typeof DealerPatch>): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const p = DealerPatch.safeParse(patch);
  if (!p.success) return fail(p.error.issues[0].message);
  const { website, ...rest } = p.data;
  await prisma.dealer.update({ where: { id }, data: { ...rest, ...(website !== undefined ? { website: website || null } : {}) } });
  return done();
}

/** Swap with the neighbour; order numbers are rewritten 1..n so they stay contiguous */
export async function moveDealer(id: string, dir: -1 | 1): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const all = await prisma.dealer.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true } });
  const i = all.findIndex((d) => d.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= all.length) return { ok: true };
  [all[i], all[j]] = [all[j], all[i]];
  await prisma.$transaction(all.map((d, k) => prisma.dealer.update({ where: { id: d.id }, data: { sortOrder: k + 1 } })));
  return done();
}

const NewDealer = z.object({
  name: z.string().trim().min(1, "Nhập tên đại lý.").max(80),
  website: DealerPatch.shape.website,
});

export async function addDealer(input: z.input<typeof NewDealer>): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const p = NewDealer.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const base = normKey(p.data.name) || "daily";
  let id = base;
  for (let n = 2; await prisma.dealer.findUnique({ where: { id } }); n++) id = `${base}${n}`;
  const max = await prisma.dealer.aggregate({ _max: { sortOrder: true } });
  await prisma.dealer.create({
    data: { id, name: p.data.name, website: p.data.website || null, sortOrder: (max._max.sortOrder ?? 0) + 1, status: "ok", visible: true },
  });
  return done(`Đã thêm ${p.data.name} (mã: ${id}). Dùng mã này hoặc tên trong cột dealer của file giá.`);
}

/** Only dealers without any price history can be deleted; the others are hidden instead */
export async function deleteDealer(id: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const used = await prisma.priceSnapshot.count({ where: { dealerId: id } });
  if (used) return fail(`Đại lý này có ${used} giá trong lịch sử. Tắt "Hiện cột" để ẩn thay vì xoá, để giữ lịch sử giá.`);
  await prisma.dealer.delete({ where: { id } });
  return done("Đã xoá đại lý.");
}

// --- Segments ---

const SegmentPatch = z.object({
  verdict: z.enum(["lead", "even", "weak"]).nullable().optional(),
  conclusionVi: z.string().trim().max(4000).optional(),
});

export async function updateSegment(id: string, patch: z.input<typeof SegmentPatch>): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const p = SegmentPatch.safeParse(patch);
  if (!p.success) return fail(p.error.issues[0].message);
  await prisma.segment.update({ where: { id }, data: p.data });
  return done("Đã lưu phân khúc.");
}

// --- Unmatched price rows ---

/**
 * Teach the matcher that this dealer listing is `productId`: adds an alias for future uploads and
 * turns the stored unmatched rows with the same name into real prices.
 */
export async function mapUnmatched(unmatchedId: number, productId: number): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const [u, product] = await Promise.all([
    prisma.unmatchedPrice.findUnique({ where: { id: unmatchedId } }),
    prisma.product.findUnique({ where: { id: productId }, select: { id: true, model: true, aliases: true } }),
  ]);
  if (!u || !product) return fail("Không tìm thấy dòng hoặc mẫu.");
  const keys = [normKey(u.nameOnSite), u.slugInFile ? normKey(u.slugInFile) : ""].filter(Boolean);
  const same = await prisma.unmatchedPrice.findMany({ where: { OR: [{ nameOnSite: u.nameOnSite }, ...(u.slugInFile ? [{ slugInFile: u.slugInFile }] : [])] } });

  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id: product.id }, data: { aliases: [...new Set([...product.aliases, ...keys])] } });
    await tx.priceSnapshot.createMany({
      skipDuplicates: true,
      data: same.map((r) => {
        const note = r.note?.split(" · ")[0] || null; // drop the "Không có mẫu ..." reason added at import
        return { importId: r.importId, productId: product.id, dealerId: r.dealerId, priceVnd: r.priceVnd, listPriceVnd: null, ...classifyStock(note, r.priceVnd), note, nameOnSite: r.nameOnSite, url: r.url, capturedAt: r.capturedAt };
      }),
    });
    await tx.unmatchedPrice.deleteMany({ where: { id: { in: same.map((r) => r.id) } } });
  });
  return done(`Đã gắn “${u.nameOnSite}” vào ${product.model}. Các lần tải lên sau sẽ tự khớp.`);
}

export async function dismissUnmatched(unmatchedId: number): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const u = await prisma.unmatchedPrice.findUnique({ where: { id: unmatchedId } });
  if (u) await prisma.unmatchedPrice.deleteMany({ where: { nameOnSite: u.nameOnSite, dealerId: u.dealerId } });
  return done("Đã bỏ qua dòng này.");
}

// --- Imports ---

/** Undo an upload made from this screen (the seed import stays) */
export async function deleteImport(importId: number): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const imp = await prisma.priceImport.findUnique({ where: { id: importId }, select: { source: true } });
  if (!imp) return fail("Không tìm thấy lần tải lên này.");
  if (imp.source !== "admin") return fail("Chỉ huỷ được các lần tải lên từ trang Quản trị.");
  await prisma.priceImport.delete({ where: { id: importId } });
  return done("Đã huỷ lần tải lên. Bảng giá quay về lần cập nhật trước đó.");
}
