import { describe, expect, it } from "vitest";

import { COMPARE_FIELDS, bestIndexes, rowIsSame, type Comparable } from "./compare";

describe("bestIndexes", () => {
  it("marks the highest when higher is better", () => {
    expect([...bestIndexes([240, 280, 240], "high")]).toEqual([1]);
  });
  it("marks the lowest when lower is better, ties included", () => {
    expect([...bestIndexes([15_690_000, 16_490_000, 15_690_000], "low")]).toEqual([0, 2]);
  });
  it("ignores missing values", () => {
    expect([...bestIndexes([null, 1000, 1500], "high")]).toEqual([2]);
  });
  it("marks nothing when all values are equal or only one has data", () => {
    expect(bestIndexes([0.03, 0.03, 0.03], "low").size).toBe(0);
    expect(bestIndexes([null, 335, null], "high").size).toBe(0);
  });
});

describe("rowIsSame", () => {
  const base: Comparable = {
    slug: "a", brand: "GIGABYTE", model: "A", isGigabyte: true, sizeIn: 27, panel: "WOLED", resolution: "2560x1440",
    refreshHz: 280, responseMs: 0.03, brightnessSdrNits: 335, brightnessHdrPeakNits: 1500, dciP3Pct: 99.5, hdr: null,
    dpVer: "2.1", hdmiVer: "2.1", usbC: true, usbCPdW: 15, heightAdjMm: 130, pivot: true, kvm: null, minPrice: null, inStock: 0, sellers: 0,
  };
  const field = (k: string) => COMPARE_FIELDS.find((f) => f.key === k)!;
  it("detects identical and different rows", () => {
    expect(rowIsSame(field("size"), [base, { ...base, slug: "b" }])).toBe(true);
    expect(rowIsSame(field("hz"), [base, { ...base, refreshHz: 240 }])).toBe(false);
  });
  it("treats no USB-C as the worst PD value", () => {
    const f = field("pd");
    expect([...bestIndexes([base, { ...base, usbC: false, usbCPdW: null }].map((p) => f.rank!(p)), "high")]).toEqual([0]);
  });
});
