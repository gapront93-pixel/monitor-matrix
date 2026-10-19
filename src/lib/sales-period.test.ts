import { describe, expect, it } from "vitest";

import { monthsBetween, parsePreset, resolveRange, shiftMonth } from "./sales-period";

describe("resolveRange", () => {
  const now = "2026-10";
  it("follows the dashboard presets", () => {
    expect(resolveRange("this-month", now)).toEqual({ from: "2026-10", to: "2026-10" });
    expect(resolveRange("last-month", now)).toEqual({ from: "2026-09", to: "2026-09" });
    expect(resolveRange("this-quarter", now)).toEqual({ from: "2026-10", to: "2026-10" });
    expect(resolveRange("last-quarter", now)).toEqual({ from: "2026-07", to: "2026-09" });
    expect(resolveRange("this-year", now)).toEqual({ from: "2026-01", to: "2026-10" });
    expect(resolveRange("last-year", now)).toEqual({ from: "2025-01", to: "2025-12" });
  });
  it("crosses the year in January", () => {
    expect(resolveRange("last-month", "2027-01")).toEqual({ from: "2026-12", to: "2026-12" });
    expect(resolveRange("last-quarter", "2027-02")).toEqual({ from: "2026-10", to: "2026-12" });
  });
  it("keeps a custom range, swapped when reversed, and falls back on bad input", () => {
    expect(resolveRange("custom", now, "2026-05", "2026-02")).toEqual({ from: "2026-02", to: "2026-05" });
    expect(resolveRange("custom", now, "2026-13", "2026-02")).toEqual({ from: "2026-07", to: "2026-09" });
  });
  it("parses and counts", () => {
    expect(parsePreset("nope")).toBe("last-quarter");
    expect(parsePreset("last-year")).toBe("last-year");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthsBetween("2025-11", "2026-02")).toBe(4);
  });
});
