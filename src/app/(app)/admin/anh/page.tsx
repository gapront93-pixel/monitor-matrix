import type { Metadata } from "next";

import { ImagesManager } from "@/components/admin/images-manager";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { requireUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { imageUrls } from "@/lib/images";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Ảnh sản phẩm" };

export default async function ImagesPage() {
  const me = await requireUser();
  if (!can(me.role, "images")) {
    return (
      <EmptyState
        title="Bạn không có quyền quản lý ảnh"
        action={
          <ButtonLink href="/" variant="primary" size="sm">
            Về Tổng quan
          </ButtonLink>
        }
      >
        Cần vai trò Mod hoặc Admin.
      </EmptyState>
    );
  }
  const [products, dealers, pages] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ isGigabyte: "desc" }, { model: "asc" }],
      select: { id: true, slug: true, model: true, brand: true, isGigabyte: true, imageFile: true, imageSource: true, imageSourceUrl: true, imageUpdatedAt: true, url: true },
    }),
    prisma.dealer.findMany({ select: { id: true, name: true } }),
    prisma.priceSnapshot.groupBy({ by: ["productId"], where: { url: { startsWith: "http" } }, _count: { _all: true } }),
  ]);
  const dealerName = new Map(dealers.map((d) => [d.id, d.name]));
  const pageCount = new Map(pages.map((p) => [p.productId, p._count._all]));

  return (
    <>
      <PageHeader
        eyebrow="Quản lý"
        title="Ảnh sản phẩm"
        sub={`${products.filter((p) => p.isGigabyte && p.imageFile).length}/${products.filter((p) => p.isGigabyte).length} mẫu GIGABYTE có ảnh · ${products.filter((p) => !p.isGigabyte && p.imageFile).length}/${products.filter((p) => !p.isGigabyte).length} mẫu đối thủ`}
      />
      <ImagesManager
        items={products.map((p) => {
          const src = p.imageSource;
          return {
            id: p.id,
            slug: p.slug,
            model: p.model,
            brand: p.brand,
            isGigabyte: p.isGigabyte,
            thumb: imageUrls(p).thumb,
            source: !src ? null : src === "upload" ? "Tải lên" : src === "maker" ? "Trang hãng" : `Tự động · ${dealerName.get(src.slice(7)) ?? src.slice(7)}`,
            kind: !src ? "none" : src === "upload" ? "upload" : "auto",
            sourceUrl: p.imageSourceUrl,
            updated: p.imageUpdatedAt ? fmtDate(p.imageUpdatedAt) : null,
            dealerPages: pageCount.get(p.id) ?? 0,
            makerUrl: p.url,
          };
        })}
      />
    </>
  );
}
