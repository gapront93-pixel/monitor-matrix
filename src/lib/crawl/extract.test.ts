import { describe, expect, it } from "vitest";

import { extractOffer, offerNote } from "./extract";

const ld = (o: unknown) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;

describe("extractOffer", () => {
  it("reads the JSON-LD Product offer", () => {
    const o = extractOffer(ld({ "@type": "Product", name: "GIGABYTE G27Q3", offers: { price: "6180000", availability: "https://schema.org/InStock" } }));
    expect(o).toMatchObject({ priceVnd: 6180000, availability: "in_stock", name: "GIGABYTE G27Q3", via: "ld" });
  });

  it("accepts JSON-LD with raw line breaks, // comments and formatted prices", () => {
    const html = `<script type="application/ld+json">{
      "@type": "Product", "name": "GS25F2", "description": "a
b",
      "offers": { "price": "7,600,000",
      //"priceValidUntil": "2025-12-31",
      "availability": "http://schema.org/OutOfStock" }
    }</script>`;
    expect(extractOffer(html)).toMatchObject({ priceVnd: 7600000, availability: "out_of_stock" });
  });

  it("falls back to product:price meta and microdata (Haravan x100 prices)", () => {
    expect(extractOffer(`<meta property="product:price:amount" content="4190000">`).priceVnd).toBe(4190000);
    expect(extractOffer(`<meta itemprop="price" content="1499000000"><link itemprop="availability" href="http://schema.org/InStock">`)).toMatchObject({
      priceVnd: 14990000,
      availability: "in_stock",
      via: "microdata",
    });
  });

  it("reads pcmarket's hidden main price", () => {
    expect(extractOffer(`<input type="hidden" id="js-pd-combo-product-main-price" value="2590000">`)).toMatchObject({ priceVnd: 2590000, via: "site" });
  });

  it("uses FPT Shop's final price when JSON-LD has the list price", () => {
    const html = ld({ "@type": "Product", name: "GS25F2", offers: { price: 3990000 } }) + `<script>push("\\"price\\":3990000,\\"discount\\":500000,\\"finalPrice\\":3490000,")</script>`;
    expect(extractOffer(html)).toMatchObject({ priceVnd: 3490000, listPriceVnd: 3990000 });
  });

  it("reports pages without a price", () => {
    expect(extractOffer("<html><title>Lê Huy</title></html>").via).toBe("none");
    expect(extractOffer(ld({ "@type": "Product", offers: { price: 0 } })).priceVnd).toBeNull();
  });
});

describe("offerNote", () => {
  const base = { listPriceVnd: null, name: null, via: "ld" as const };
  it("speaks the words classifyStock understands", () => {
    expect(offerNote({ ...base, priceVnd: 1, availability: "in_stock" })).toBe("Còn hàng");
    expect(offerNote({ ...base, priceVnd: 1, availability: "out_of_stock" })).toBe("Hết hàng");
    expect(offerNote({ ...base, priceVnd: 1, availability: "preorder" })).toBe("Hàng sắp về");
    expect(offerNote({ ...base, priceVnd: null, availability: null })).toBe("Liên hệ");
    expect(offerNote({ ...base, priceVnd: 1, availability: null })).toBeNull();
  });
});
