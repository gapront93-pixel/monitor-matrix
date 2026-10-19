import type { Metadata } from "next";

import { ImagesManager } from "@/components/admin/images-manager";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { requireUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { adminMessages } from "@/lib/i18n/messages/admin";
import { getT } from "@/lib/i18n/server";
import { imageUrls } from "@/lib/images";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT(adminMessages)).images.title };
}

export default async function ImagesPage() {
  const [me, a] = await Promise.all([requireUser(), getT(adminMessages)]);
  const t = a.images;
  if (!can(me.role, "images")) {
    return (
      <EmptyState
        title={t.noAccess}
        action={
          <ButtonLink href="/" variant="primary" size="sm">
            {a.page.home}
          </ButtonLink>
        }
      >
        {t.noAccessText}
      </EmptyState>
    );
  }
  const [products, dealers, pages] = await Promise.all([
    prisma.product.findMany({
      where: { hidden: false },
      orderBy: [{ isGigabyte: "desc" }, { model: "asc" }],
      select: { id: true, slug: true, model: true, brand: true, isGigabyte: true, imageFile: true, imageSource: true, imageSourceUrl: true, imageUpdatedAt: true, url: true },
    }),
    prisma.dealer.findMany({ select: { id: true, name: true } }),
    prisma.priceSnapshot.groupBy({ by: ["productId"], where: { url: { startsWith: "http" } }, _count: { _all: true } }),
  ]);
  const dealerName = new Map(dealers.map((d) => [d.id, d.name]));
  const pageCount = new Map(pages.map((p) => [p.productId, p._count._all]));
  const sourceLabel = (src: string | null): string | null => {
    if (!src) return null;
    if (src === "upload") return t.source.upload;
    if (src === "link") return t.source.link;
    if (src === "maker") return t.source.maker;
    const [kind, id] = src.split(":");
    const name = dealerName.get(id) ?? id;
    return kind === "gigabyte" ? t.source.official(name) : t.source.dealer(name);
  };
  const gb = products.filter((p) => p.isGigabyte);
  const rivals = products.filter((p) => !p.isGigabyte);

  return (
    <>
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        sub={t.sub(gb.filter((p) => p.imageFile).length, gb.length, rivals.filter((p) => p.imageFile).length, rivals.length)}
      />
      <ImagesManager
        items={products.map((p) => ({
          id: p.id,
          slug: p.slug,
          model: p.model,
          brand: p.brand,
          isGigabyte: p.isGigabyte,
          thumb: imageUrls(p).thumb,
          source: sourceLabel(p.imageSource),
          kind: !p.imageSource ? "none" : p.imageSource === "upload" || p.imageSource === "link" ? "manual" : "auto",
          sourceUrl: p.imageSourceUrl,
          updated: p.imageUpdatedAt ? fmtDate(p.imageUpdatedAt) : null,
          dealerPages: pageCount.get(p.id) ?? 0,
          makerUrl: p.url,
        }))}
      />
    </>
  );
}
