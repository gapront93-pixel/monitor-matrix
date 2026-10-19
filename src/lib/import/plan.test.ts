import { describe, expect, it } from "vitest";

import { planImport, productIndex, type DealerState, type StateSnap } from "./plan";
import { parseLongCsv, parsePriceFile, vnDate, type ParsedPriceFile } from "./prices";

const products = [
  { id: 1, slug: "MO27Q28G", model: "MO27Q28G", aliases: [] },
  { id: 2, slug: "AORUS-FO32U2P", model: "AORUS FO32U2P", aliases: [] },
  { id: 3, slug: "G27Q20", model: "G27Q20", aliases: [] },
  { id: 4, slug: "G34WQCP-rev-10", model: "G34WQCP (Rev. 1.0)", aliases: ["g34wqcp"] },
  { id: 5, slug: "G34WQCP-rev-20", model: "G34WQCP (Rev. 2.0)", aliases: ["g34wqcp"] },
];
const idx = productIndex(products);
const day = vnDate("2026-10-19")!;

const snap = (productId: number, priceVnd: number | null, extra: Partial<StateSnap> = {}): StateSnap => ({
  productId,
  priceVnd,
  listPriceVnd: null,
  inStock: null,
  stockStatus: priceVnd === null ? "contact" : "unknown",
  note: null,
  nameOnSite: null,
  url: `https://x.vn/${productId}`,
  capturedAt: vnDate("2026-10-18")!,
  ...extra,
});

const stateOf = (dealer: string, snaps: StateSnap[]): Map<string, DealerState> =>
  new Map([[dealer, { importId: 1, capturedAt: vnDate("2026-10-18")!, snaps: new Map(snaps.map((s) => [s.productId, s])) }]]);

const file = (rows: ParsedPriceFile["rows"], dealers = ["gearvn"]): ParsedPriceFile => ({
  format: "long-csv",
  capturedAt: null,
  dealers: dealers.map((id) => ({ id, name: id, website: null, status: "ok", note: null })),
  rows,
  warnings: [],
});
const row = (dealerId: string, slug: string, priceVnd: number | null, note: string | null = null) => ({
  dealerId,
  slugInFile: slug,
  nameOnSite: slug,
  priceVnd,
  listPriceVnd: null,
  url: null,
  note,
});

describe("planImport (upload diff)", () => {
  const state = stateOf("gearvn", [snap(1, 16_490_000), snap(2, 26_990_000), snap(3, 4_390_000)]);

  it("classifies price up, price down, stock change, new, removed and unchanged", () => {
    const plan = planImport(
      file([
        row("gearvn", "MO27Q28G", 15_990_000), // down
        row("gearvn", "AORUS-FO32U2P", 27_490_000), // up
        row("gearvn", "G34WQCP-rev-20", 6_950_000), // new
      ]),
      day,
      idx,
      state,
      new Set(["gearvn"]),
    );
    const byProduct = Object.fromEntries(plan.changes.map((c) => [c.productId, c]));
    expect(byProduct[1]).toMatchObject({ kind: "price", before: { priceVnd: 16_490_000 }, after: { priceVnd: 15_990_000 } });
    expect(byProduct[2]).toMatchObject({ kind: "price", before: { priceVnd: 26_990_000 }, after: { priceVnd: 27_490_000 } });
    expect(byProduct[5]).toMatchObject({ kind: "new", before: null });
    expect(byProduct[3]).toMatchObject({ kind: "removed", after: null }); // G27Q20 not in the new file
    expect(plan.counts).toMatchObject({ price: 2, new: 1, removed: 1, same: 0 });
  });

  it("keeps the previous dealer link when the file has none, and sees stock-only changes", () => {
    const plan = planImport(file([row("gearvn", "MO27Q28G", 16_490_000, "Hết hàng")]), day, idx, state, new Set(["gearvn"]));
    expect(plan.snapshots[0].url).toBe("https://x.vn/1");
    expect(plan.changes.find((c) => c.productId === 1)).toMatchObject({ kind: "stock" });
  });

  it("carries over the prices a partial file does not mention when asked to", () => {
    const plan = planImport(file([row("gearvn", "MO27Q28G", 15_990_000)]), day, idx, state, new Set(["gearvn"]), { keepMissing: true });
    expect(plan.counts).toMatchObject({ price: 1, removed: 0, same: 2 });
    expect(plan.snapshots.map((s) => [s.productId, s.priceVnd]).sort()).toEqual([
      [1, 15_990_000],
      [2, 26_990_000],
      [3, 4_390_000],
    ]);
  });

  it("does not touch dealers the file does not cover", () => {
    const plan = planImport(file([row("tgdd", "MO27Q28G", 15_690_000)], ["tgdd"]), day, idx, state, new Set(["gearvn", "tgdd"]));
    expect(plan.changes.filter((c) => c.kind === "removed")).toHaveLength(0);
  });

  it("puts unknown or ambiguous models in the unmatched list", () => {
    const plan = planImport(file([row("gearvn", "FI27Q", 11_000_000), row("gearvn", "G34WQCP", 7_000_000)]), day, idx, state, new Set(["gearvn"]));
    expect(plan.unmatched.map((u) => u.reason)).toEqual(['Không có mẫu "FI27Q"', '"G34WQCP" khớp nhiều mẫu']);
  });

  it("merges a model listed twice by one dealer, keeping the buyable cheaper one", () => {
    const plan = planImport(
      file([row("gearvn", "MO27Q28G", 15_000_000, "Hết hàng"), row("gearvn", "MO27Q28G", 16_000_000), row("gearvn", "MO27Q28G", 16_200_000)]),
      day,
      idx,
      new Map(),
      new Set(["gearvn"]),
    );
    expect(plan.snapshots).toHaveLength(1);
    expect(plan.snapshots[0].priceVnd).toBe(16_000_000);
    expect(plan.counts.duplicates).toBe(2);
  });

  it("flags dealers that do not exist yet", () => {
    const plan = planImport(file([row("newshop", "MO27Q28G", 1)], ["newshop"]), day, idx, new Map(), new Set(["gearvn"]));
    expect(plan.newDealers.map((d) => d.id)).toEqual(["newshop"]);
  });
});

describe("parseLongCsv", () => {
  const dealers = [
    { id: "gearvn", name: "GEARVN" },
    { id: "tgdd", name: "Thế Giới Di Động" },
  ];
  it("reads model, dealer (id or name), price and status", () => {
    const r = parseLongCsv(
      "model,dealer,price,status,url\nMO27Q28G,GEARVN,16490000,ok,https://gearvn.com/x\nMO27Q28G,Thế Giới Di Động,\"15,690,000\",oos,\nG27Q20,tgdd,,contact,\n",
      dealers,
    );
    expect(r.dealers.map((d) => d.id)).toEqual(["gearvn", "tgdd"]);
    expect(r.rows).toEqual([
      { dealerId: "gearvn", slugInFile: "MO27Q28G", nameOnSite: "MO27Q28G", priceVnd: 16_490_000, listPriceVnd: null, url: "https://gearvn.com/x", note: "Còn hàng" },
      { dealerId: "tgdd", slugInFile: "MO27Q28G", nameOnSite: "MO27Q28G", priceVnd: 15_690_000, listPriceVnd: null, url: null, note: "Hết hàng" },
      { dealerId: "tgdd", slugInFile: "G27Q20", nameOnSite: "G27Q20", priceVnd: null, listPriceVnd: null, url: null, note: "Liên hệ" },
    ]);
    expect(r.warnings).toEqual([]);
  });
  it("reports bad lines with their line number and keeps the good ones", () => {
    const r = parseLongCsv("model,dealer,price,status\nA,Shop lạ,1,ok\nB,GEARVN,abc,ok\nC,GEARVN,100,maybe\nD,GEARVN,,ok\nE,GEARVN,200,ok\n", dealers);
    expect(r.rows.map((x) => x.slugInFile)).toEqual(["E"]);
    expect(r.warnings.map((w) => w.slice(0, 7))).toEqual(["Dòng 2:", "Dòng 3:", "Dòng 4:", "Dòng 5:"]);
  });
  it("rejects a file without the required columns", () => {
    expect(() => parseLongCsv("model,price\nA,1\n", dealers)).toThrow(/dealer/);
  });
  it("is picked automatically from the header", () => {
    expect(parsePriceFile("gia.csv", "model,dealer,price,status\nA,GEARVN,1,ok\n", dealers).format).toBe("long-csv");
    expect(parsePriceFile("bang-gia.csv", "model,slug,GEARVN\nA,A,1\n", dealers).format).toBe("bang-gia-csv");
    expect(() => parsePriceFile("gia.xlsx", "", dealers)).toThrow(/json hoặc .csv/);
  });
});
