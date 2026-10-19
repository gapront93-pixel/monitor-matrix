import { describe, expect, it } from "vitest";

import { inStockCount, lowestPrice, priceLink, type PriceCell } from "./pricing";

const cell = (p: Partial<PriceCell>): PriceCell => ({
  dealerId: "a",
  priceVnd: 1_000_000,
  listPriceVnd: null,
  stockStatus: "unknown",
  priceType: "retail",
  url: null,
  nameOnSite: null,
  note: null,
  ...p,
});

describe("lowestPrice", () => {
  it("picks the cheapest buyable retail price", () => {
    const r = lowestPrice([
      cell({ dealerId: "gearvn", priceVnd: 16_490_000 }),
      cell({ dealerId: "tgdd", priceVnd: 15_690_000 }),
      cell({ dealerId: "kcc", priceVnd: 16_160_000, stockStatus: "in_stock" }),
    ]);
    expect(r).toEqual({ price: 15_690_000, dealerIds: ["tgdd"] });
  });

  it("ignores wholesale prices even when they are lower", () => {
    const r = lowestPrice([cell({ dealerId: "lephung", priceVnd: 13_780_000, priceType: "dealer" }), cell({ dealerId: "tgdd", priceVnd: 15_690_000 })]);
    expect(r.price).toBe(15_690_000);
  });

  it("ignores out of stock, discontinued and contact-only cells", () => {
    const r = lowestPrice([
      cell({ dealerId: "a", priceVnd: 9_000_000, stockStatus: "out_of_stock" }),
      cell({ dealerId: "b", priceVnd: 9_500_000, stockStatus: "discontinued" }),
      cell({ dealerId: "c", priceVnd: null, stockStatus: "contact" }),
      cell({ dealerId: "d", priceVnd: 10_000_000 }),
    ]);
    expect(r).toEqual({ price: 10_000_000, dealerIds: ["d"] });
  });

  it("lists every dealer tied on the lowest price", () => {
    const r = lowestPrice([cell({ dealerId: "dmx", priceVnd: 15_690_000 }), cell({ dealerId: "tgdd", priceVnd: 15_690_000 })]);
    expect(r.dealerIds).toEqual(["dmx", "tgdd"]);
  });

  it("returns null when nothing can be bought", () => {
    expect(lowestPrice([cell({ stockStatus: "out_of_stock" })])).toEqual({ price: null, dealerIds: [] });
    expect(lowestPrice([])).toEqual({ price: null, dealerIds: [] });
  });
});

describe("inStockCount", () => {
  it("counts retail dealers with a buyable price", () => {
    expect(
      inStockCount([
        cell({}),
        cell({ priceType: "dealer" }),
        cell({ stockStatus: "out_of_stock" }),
        cell({ priceVnd: null, stockStatus: "contact" }),
        cell({ stockStatus: "in_stock" }),
      ]),
    ).toBe(2);
  });
});

describe("priceLink", () => {
  it("prefers the product page, falls back to a dealer search", () => {
    expect(priceLink({ url: "https://gearvn.com/p/x" }, "https://gearvn.com", "MO27Q28G")).toBe("https://gearvn.com/p/x");
    expect(priceLink({ url: null }, "https://gearvn.com/", "AORUS FO32U2P")).toBe("https://gearvn.com/search?q=AORUS%20FO32U2P");
    expect(priceLink({ url: null }, null, "X")).toBeNull();
  });
});
