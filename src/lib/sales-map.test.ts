import { describe, expect, it } from "vitest";

import { productIndex } from "./import/plan";
import { matchSale, saleCandidates } from "./sales-map";

const idx = productIndex([
  { id: 1, slug: "GS24F14", model: "GS24F14", aliases: [] },
  { id: 2, slug: "GS27FA", model: "GS27FA", aliases: [] },
  { id: 3, slug: "G27Q20T", model: "G27Q20T", aliases: [] },
  { id: 4, slug: "G25F2A", model: "G25F2A", aliases: [] },
  { id: 5, slug: "G25F2", model: "G25F2", aliases: [] },
  { id: 6, slug: "G34WQCP-rev-10", model: "G34WQCP (Rev. 1.0)", aliases: ["g34wqcp"] },
  { id: 7, slug: "G34WQCP-rev-20", model: "G34WQCP (Rev. 2.0)", aliases: ["g34wqcp"] },
]);

describe("saleCandidates", () => {
  it("strips the SKU prefix and suffixes", () => {
    expect(saleCandidates("GAGS24F14_EK1", null)).toContain("gs24f14");
    expect(saleCandidates("GS27FABT1", null)[0]).toBe("gs27fa");
    expect(saleCandidates("G27Q20T EK", null)[0]).toBe("g27q20t");
    expect(saleCandidates("GAG25F2A_EK1", null)).toContain("g25f2a");
  });
  it("puts soModel first", () => {
    expect(saleCandidates("GS27FABT2", "GS27FA")[0]).toBe("gs27fa");
  });
});

describe("matchSale", () => {
  it("finds the catalog product", () => {
    expect(matchSale("GAGS24F14_EK1", "GS24F14", idx)).toBe(1);
    expect(matchSale("GS27FABT1", null, idx)).toBe(2);
    expect(matchSale("GAG25F2A_EK1", null, idx)).toBe(4);
    expect(matchSale("G25F2", null, idx)).toBe(5);
  });
  it("sends a code shared by revisions to the newest revision", () => {
    const models: Record<number, string> = { 6: "G34WQCP (Rev. 1.0)", 7: "G34WQCP (Rev. 2.0)" };
    expect(matchSale("G34WQCP", null, idx, (id) => models[id] ?? "")).toBe(7);
  });
  it("leaves ambiguous and unknown models unmatched", () => {
    expect(matchSale("G34WQCP", null, idx)).toBeNull();
    expect(matchSale("XYZ123", null, idx)).toBeNull();
    expect(matchSale(null, null, idx)).toBeNull();
  });
});
