import { describe, expect, it } from "vitest";

import { parseCsv } from "./csv";
import { classifyStock, parseBangGiaCsv, parseDealerJson, vnDate } from "./prices";

describe("parseCsv", () => {
  it("handles BOM, quotes, escaped quotes, commas and CRLF", () => {
    const rows = parseCsv('\uFEFFmodel,size\r\n"AORUS FO32U2P","31.5"" QD-OLED, 4K"\r\nG27Q20,27\r\n\r\n');
    expect(rows).toEqual([
      ["model", "size"],
      ["AORUS FO32U2P", '31.5" QD-OLED, 4K'],
      ["G27Q20", "27"],
    ]);
  });

  it("keeps a last line without newline", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("classifyStock", () => {
  it("follows the approved price table rules", () => {
    expect(classifyStock("Hết hàng", 4_000_000).stockStatus).toBe("out_of_stock");
    expect(classifyStock("Tạm hết hàng", 4_000_000).stockStatus).toBe("out_of_stock");
    expect(classifyStock("Hàng sắp về", 4_000_000).stockStatus).toBe("out_of_stock");
    expect(classifyStock("Liên hệ; ngừng kinh doanh", null).stockStatus).toBe("discontinued");
    expect(classifyStock("Liên hệ", null)).toEqual({ stockStatus: "contact", inStock: null });
    expect(classifyStock("Còn hàng", 4_000_000)).toEqual({ stockStatus: "in_stock", inStock: true });
    expect(classifyStock("Hàng đặt trước", 4_000_000).stockStatus).toBe("unknown");
    expect(classifyStock(null, 4_000_000).stockStatus).toBe("unknown");
  });
});

describe("parseBangGiaCsv", () => {
  const dealers = [
    { id: "lephung", name: "Lê Phụng" },
    { id: "tgdd", name: "Thế Giới Di Động" },
  ];

  it("maps dealer columns by name (with or without a suffix) and reads prices", () => {
    const csv = "model,slug,Lê Phụng (giá đại lý),Thế Giới Di Động,Cửa hàng lạ,gia_thap_nhat,so_noi_ban\n" + 'MO27Q28G,MO27Q28G,"13,780,000",15690000,1,15690000,1\n' + "G27Q20,G27Q20,,Liên hệ,,,0\n";
    const r = parseBangGiaCsv(csv, dealers);
    expect(r.dealers.map((d) => d.id)).toEqual(["lephung", "tgdd"]);
    expect(r.warnings).toHaveLength(1);
    expect(r.rows).toEqual([
      { dealerId: "lephung", slugInFile: "MO27Q28G", nameOnSite: "MO27Q28G", priceVnd: 13_780_000, listPriceVnd: null, url: null, note: null },
      { dealerId: "tgdd", slugInFile: "MO27Q28G", nameOnSite: "MO27Q28G", priceVnd: 15_690_000, listPriceVnd: null, url: null, note: null },
      { dealerId: "tgdd", slugInFile: "G27Q20", nameOnSite: "G27Q20", priceVnd: null, listPriceVnd: null, url: null, note: "Liên hệ" },
    ]);
  });

  it("keeps a stock word written next to the price", () => {
    const r = parseBangGiaCsv("slug,Thế Giới Di Động\nM27U,10090000 (Hết hàng)\n", dealers);
    expect(r.rows[0]).toMatchObject({ priceVnd: 10_090_000, note: "Hết hàng" });
  });

  it("rejects a file without slug or model column", () => {
    expect(() => parseBangGiaCsv("a,b\n1,2\n", dealers)).toThrow(/slug/);
  });
});

describe("parseDealerJson", () => {
  it("reads one dealer file with its date", () => {
    const r = parseDealerJson(
      JSON.stringify({
        retailer: "GEARVN",
        retailer_id: "gearvn",
        site: "https://gearvn.com",
        status: "ok",
        fetched: "2026-10-18",
        items: [{ slug: "MO27Q28G", name_on_site: "Màn hình MO27Q28G", price_vnd: 16490000, list_price_vnd: null, url: "https://gearvn.com/x", note: "" }],
      }),
    );
    expect(r.capturedAt).toEqual(vnDate("2026-10-18"));
    expect(r.dealers[0]).toMatchObject({ id: "gearvn", name: "GEARVN", website: "https://gearvn.com" });
    expect(r.rows[0]).toMatchObject({ slugInFile: "MO27Q28G", priceVnd: 16_490_000, note: null });
  });

  it("explains a broken file in Vietnamese", () => {
    expect(() => parseDealerJson("{oops")).toThrow(/không hợp lệ/);
    expect(() => parseDealerJson('{"retailer":"X"}')).toThrow(/retailer_id/);
  });
});
