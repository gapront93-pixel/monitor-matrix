import "server-only";

import { connection } from "next/server";
import { cache } from "react";

import type { Comparable } from "./compare";
import { getPriceState } from "./import/plan";
import { endOfVnDay } from "./format";
import { imageUrls } from "./image-names";
import { prisma } from "./prisma";
import { inStockCount, lowestPrice, type PriceCell } from "./pricing";

export type DealerView = {
  id: string;
  name: string;
  website: string | null;
  sortOrder: number;
  isKey: boolean;
  priceType: "retail" | "dealer";
  visible: boolean;
  status: string;
};

export type ProductView = {
  id: number;
  slug: string;
  brand: string;
  isGigabyte: boolean;
  model: string;
  series: string | null;
  line: string | null;
  segmentId: string | null;
  sizeIn: number | null;
  panel: string | null;
  shape: string | null;
  resolution: string | null;
  refreshHz: number | null;
  responseMs: number | null;
  brightnessSdrNits: number | null;
  brightnessHdrPeakNits: number | null;
  hdr: string | null;
  dciP3Pct: number | null;
  contrast: string | null;
  hdmiVer: string | null;
  dpVer: string | null;
  usbC: boolean | null;
  usbCPdW: number | null;
  kvm: boolean | null;
  heightAdjMm: number | null;
  pivot: boolean | null;
  url: string | null;
  image: string | null; // /anh/<slug>.webp?v=..
  thumb: string | null;
  prices: PriceCell[]; // in dealer column order
  minPrice: number | null;
  minDealerIds: string[];
  inStock: number; // retail dealers that sell it now
  sellers: number; // dealers listing it at all
};

export type SegmentView = {
  id: string;
  nameVi: string;
  shortName: string;
  verdict: "lead" | "even" | "weak" | null;
  criteria: string;
  conclusionVi: string | null;
  notes: string | null;
  sortOrder: number;
  representativeProductId: number | null;
};

export type ImportView = { id: number; capturedAt: Date; createdAt: Date; source: string; fileName: string | null };

export type Catalog = {
  products: ProductView[];
  bySlug: Map<string, ProductView>;
  dealers: DealerView[]; // all, in column order
  segments: SegmentView[];
  imports: ImportView[]; // newest first
  asOf: Date | null; // newest capturedAt among the prices shown
};

/** Everything the screens need, priced as of `day` (YYYY-MM-DD, Vietnam time) or now. One query set per request. */
export const getCatalog = cache(async (day?: string): Promise<Catalog> => {
  await connection();
  const at = day ? (endOfVnDay(day) ?? undefined) : undefined;
  const [products, dealers, segments, imports, state] = await Promise.all([
    prisma.product.findMany({ where: { hidden: false }, orderBy: [{ isGigabyte: "desc" }, { model: "asc" }], omit: { rawSpecs: true, aliases: true } }),
    prisma.dealer.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.segment.findMany({ where: { hidden: false }, orderBy: { sortOrder: "asc" } }),
    prisma.priceImport.findMany({
      orderBy: [{ capturedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true, capturedAt: true, createdAt: true, source: true, fileName: true },
    }),
    getPriceState(prisma, at),
  ]);

  const dealerViews: DealerView[] = dealers.map((d) => ({
    id: d.id,
    name: d.name,
    website: d.website,
    sortOrder: d.sortOrder,
    isKey: d.isKey,
    priceType: d.priceType,
    visible: d.visible,
    status: d.status,
  }));

  let asOf: Date | null = null;
  for (const s of state.values()) if (!asOf || s.capturedAt > asOf) asOf = s.capturedAt;

  const views: ProductView[] = products.map((p) => {
    const prices: PriceCell[] = [];
    for (const d of dealerViews) {
      const s = state.get(d.id)?.snaps.get(p.id);
      if (!s) continue;
      prices.push({
        dealerId: d.id,
        priceVnd: s.priceVnd,
        listPriceVnd: s.listPriceVnd,
        stockStatus: s.stockStatus,
        priceType: d.priceType,
        url: s.url,
        nameOnSite: s.nameOnSite,
        note: s.note,
      });
    }
    const low = lowestPrice(prices);
    const { createdAt: _c, updatedAt: _u, imageFile: _f, imageSource: _s, imageSourceUrl: _su, imageUpdatedAt: _iu, ...rest } = p;
    void [_c, _u, _f, _s, _su, _iu];
    return {
      ...rest,
      ...imageUrls(p),
      prices,
      minPrice: low.price,
      minDealerIds: low.dealerIds,
      inStock: inStockCount(prices),
      sellers: prices.length,
    };
  });

  return {
    products: views,
    bySlug: new Map(views.map((v) => [v.slug, v])),
    dealers: dealerViews,
    segments: segments.map((s) => ({
      id: s.id,
      nameVi: s.nameVi,
      shortName: s.shortName ?? s.nameVi,
      verdict: s.verdict,
      criteria: s.criteria,
      conclusionVi: s.conclusionVi,
      notes: s.notes,
      sortOrder: s.sortOrder,
      representativeProductId: s.representativeProductId,
    })),
    imports,
    asOf,
  };
});

/** The fields the comparison table and client screens need, without the price cells */
export function comparable(p: ProductView): Comparable & { line: string | null; segmentId: string | null; thumb: string | null } {
  return {
    thumb: p.thumb,
    slug: p.slug,
    brand: p.brand,
    model: p.model,
    isGigabyte: p.isGigabyte,
    line: p.line,
    segmentId: p.segmentId,
    sizeIn: p.sizeIn,
    panel: p.panel,
    resolution: p.resolution,
    refreshHz: p.refreshHz,
    responseMs: p.responseMs,
    brightnessSdrNits: p.brightnessSdrNits,
    brightnessHdrPeakNits: p.brightnessHdrPeakNits,
    dciP3Pct: p.dciP3Pct,
    hdr: p.hdr,
    dpVer: p.dpVer,
    hdmiVer: p.hdmiVer,
    usbC: p.usbC,
    usbCPdW: p.usbCPdW,
    heightAdjMm: p.heightAdjMm,
    pivot: p.pivot,
    kvm: p.kvm,
    minPrice: p.minPrice,
    inStock: p.inStock,
    sellers: p.sellers,
  };
}

/** The GIGABYTE model whose photo stands for a segment: the one picked in admin if it has a photo, else the cheapest with a photo */
export function representative(segment: Pick<SegmentView, "id" | "representativeProductId">, products: ProductView[]): ProductView | null {
  const withPhoto = products.filter((p) => p.isGigabyte && p.segmentId === segment.id && p.image);
  return (
    withPhoto.find((p) => p.id === segment.representativeProductId) ??
    [...withPhoto].sort((a, b) => (a.minPrice ?? Infinity) - (b.minPrice ?? Infinity) || a.model.localeCompare(b.model))[0] ??
    null
  );
}
