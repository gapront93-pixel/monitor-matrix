// Rows of the price grid (/bang-gia) and its Excel export, built from the catalog. Shared so both show the same thing.
import type { Catalog } from "./catalog";
import type { StockStatus } from "./import/prices";
import { isBuyable } from "./import/prices";
import { resLabel, specLine } from "./format";
import { priceLink } from "./pricing";

export type GridCell = {
  p: number | null; // price, null = Liên hệ
  s: StockStatus;
  link: string | null;
  title: string | null; // name on the dealer site + note, shown on hover
};

export type GridDealer = { id: string; name: string; isKey: boolean; wholesale: boolean };

export type GridRow = {
  slug: string;
  model: string;
  line: string | null;
  size: number | null;
  panel: string | null;
  hz: number | null;
  res: string; // QHD, 4K ...
  spec: string; // 27" WOLED 280Hz
  min: number | null;
  minDealers: string[]; // dealer names
  inStock: number;
  sellers: number;
  cells: Record<string, GridCell>;
};

export function gridDealers(catalog: Catalog): GridDealer[] {
  return catalog.dealers
    .filter((d) => d.visible)
    .map((d) => ({ id: d.id, name: d.name, isKey: d.isKey, wholesale: d.priceType === "dealer" }));
}

/** GIGABYTE models only: rivals have no Vietnamese dealer prices */
export function gridRows(catalog: Catalog): GridRow[] {
  const dealers = new Map(catalog.dealers.map((d) => [d.id, d]));
  return catalog.products
    .filter((p) => p.isGigabyte)
    .map((p) => {
      const cells: Record<string, GridCell> = {};
      for (const c of p.prices) {
        const d = dealers.get(c.dealerId);
        if (!d?.visible) continue;
        cells[c.dealerId] = {
          p: c.priceVnd,
          s: c.stockStatus,
          link: priceLink(c, d.website, p.model),
          title: [c.nameOnSite, c.note].filter(Boolean).join(" · ") || null,
        };
      }
      return {
        slug: p.slug,
        model: p.model,
        line: p.line,
        size: p.sizeIn,
        panel: p.panel,
        hz: p.refreshHz,
        res: resLabel(p.resolution),
        spec: specLine(p),
        min: p.minPrice,
        minDealers: p.minDealerIds.map((id) => dealers.get(id)?.name ?? id),
        inStock: p.inStock,
        sellers: Object.keys(cells).length,
        cells,
      };
    });
}

/** The lowest-price highlight: retail, buyable and equal to the row minimum */
export function isBestCell(row: GridRow, dealer: GridDealer, cell: GridCell): boolean {
  return !dealer.wholesale && cell.p !== null && isBuyable(cell.s) && cell.p === row.min;
}

export function hasPrice(row: GridRow): boolean {
  return Object.values(row.cells).some((c) => c.p !== null);
}

/** Search box: model code, panel, "240hz", "qhd" */
export function matchesQuery(row: GridRow, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const hay = `${row.model} ${row.panel ?? ""} ${row.hz ?? ""}hz ${row.res} ${row.line ?? ""}`.toLowerCase();
  return s.split(/\s+/).every((t) => hay.includes(t) || hay.replace(/\s+/g, "").includes(t));
}
