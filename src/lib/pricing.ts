// Price rules shared by every screen and the Excel export. Pure functions (tested in pricing.test.ts).
import { isBuyable, type StockStatus } from "./import/prices";

export type PriceType = "retail" | "dealer";

export type PriceCell = {
  dealerId: string;
  priceVnd: number | null;
  listPriceVnd: number | null;
  stockStatus: StockStatus;
  priceType: PriceType;
  url: string | null;
  nameOnSite: string | null;
  note: string | null;
};

/** Counts toward "Giá thấp nhất" and "Số nơi còn hàng": retail dealer, has a price, not out of stock or discontinued */
export function countsAsOffer(c: PriceCell): c is PriceCell & { priceVnd: number } {
  return c.priceType === "retail" && c.priceVnd !== null && isBuyable(c.stockStatus);
}

/** Lowest retail price that can be bought, and every dealer offering it */
export function lowestPrice(cells: PriceCell[]): { price: number | null; dealerIds: string[] } {
  let price: number | null = null;
  let dealerIds: string[] = [];
  for (const c of cells) {
    if (!countsAsOffer(c)) continue;
    if (price === null || c.priceVnd < price) {
      price = c.priceVnd;
      dealerIds = [c.dealerId];
    } else if (c.priceVnd === price) dealerIds.push(c.dealerId);
  }
  return { price, dealerIds };
}

export function inStockCount(cells: PriceCell[]): number {
  return cells.filter(countsAsOffer).length;
}

/** Link behind a price: the dealer's product page, else a search on the dealer site */
export function priceLink(cell: { url: string | null }, dealerWebsite: string | null, model: string): string | null {
  if (cell.url) return cell.url;
  if (!dealerWebsite) return null;
  return `${dealerWebsite.replace(/\/+$/, "")}/search?q=${encodeURIComponent(model)}`;
}
