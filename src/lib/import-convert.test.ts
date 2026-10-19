import { describe, expect, it } from "vitest";

import { convertRaw, countryAndPort, importDataProblem, normPanel, normRes } from "./import-convert";

const HEAD = ["Date", "Month", "Quarter", "Year", "Cong ty Nhap khau  ", "Ten hang", "Model", "Brand", "Size", "TYPE", "Panel", "RESOLUTION", "SCAN FREQUENCY(Hz)", "Response Time", "FOB", "QTY", "REV", "Thi truong nhap khau", "Cua khau", "DKGH", "Ma PTTT"];
const row = (o: Partial<Record<string, unknown>>) =>
  HEAD.map((h) => o[h] ?? null) as unknown[];

describe("RAW sheet conversion", () => {
  const rows = [
    HEAD,
    row({ Date: new Date("2026-09-22T09:00:00Z"), Month: 9, Year: 2026, "Cong ty Nhap khau  ": "Công Ty Cổ Phần  Thế Giới Số", Model: " gs27fa ", Brand: "GIGABYTE", Size: "27 Inch", TYPE: "FLAT", Panel: "Ips", RESOLUTION: "FullHD", "SCAN FREQUENCY(Hz)": "180hz", FOB: 86.004, QTY: 320, REV: 27521.4, "Thi truong nhap khau": "CANG CAT LAI (HCM)", "Cua khau": "China", DKGH: "FOB" }),
    row({ Date: new Date("2026-03-02T00:00:00Z"), Month: 3, Year: 2026, "Cong ty Nhap khau  ": "X", Model: "VX2479A-HD-PRO", Brand: "VIEWSONIC", Size: "24 inch", TYPE: "Curved ", Panel: "Mini-Led", RESOLUTION: "<=HD", "SCAN FREQUENCY(Hz)": "240Hz", FOB: 86, QTY: 10, REV: 860, "Thi truong nhap khau": "Taiwan", "Cua khau": "HO CHI MINH", DKGH: "CIF" }),
    row({ Date: new Date("2023-05-01T00:00:00Z"), Month: 5, Year: 2023, Model: "OLD", Brand: "LG", QTY: 5, REV: 1 }),
    row({ Date: new Date("2025-01-01T00:00:00Z"), Month: 1, Year: 2025, Model: "ZERO", Brand: "LG", QTY: 0, REV: 0 }),
  ];
  const res = convertRaw(rows, ["Gigabyte", "ViewSonic", "Viewsonic"]);
  it("keeps 2024–2026 rows with units and reports the rest", () => {
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.counts).toEqual({ 2024: 0, 2025: 0, 2026: 2 });
    expect(res.skipped).toEqual({ otherYears: 1, noQty: 1 });
    expect(res.latest).toBe("22/09/2026");
    expect(res.data.meta.latest).toBe(922);
  });
  it("normalises names, numbers and the swapped country / port columns", () => {
    if (!res.ok) return;
    const [a, b] = res.data.r2026;
    const D = res.data.dicts;
    expect(D.brand[a[4]]).toBe("Gigabyte");
    expect(D.brand[b[4]]).toBe("ViewSonic");
    expect(D.model[a[3]]).toBe("GS27FA");
    expect(D.imp[a[2]]).toBe("CÔNG TY CỔ PHẦN THẾ GIỚI SỐ");
    expect([a[5], a[6], a[7], a[8], a[9], a[10], a[11], a[12]]).toEqual([27, "Flat", "IPS", "FULLHD", 180, 86, 320, 27521]);
    expect([D.country[a[13]], D.port[a[14]], D.dk[a[15]]]).toEqual(["China", "CANG CAT LAI (HCM)", "FOB"]);
    expect([D.country[b[13]], D.port[b[14]]]).toEqual(["Taiwan", "HO CHI MINH"]);
    expect([b[6], b[7], b[8]]).toEqual(["Curved", "Mini LED", "HD"]);
  });
  it("refuses a sheet without the needed columns, and checks uploads", () => {
    expect(convertRaw([["Model", "Brand"]]).ok).toBe(false);
    expect(normRes("WXGA ")).toBe("HD");
    expect(normPanel("Oled")).toBe("OLED");
    expect(countryAndPort("HA NOI", "Bangladesh")).toEqual(["Bangladesh", "HA NOI"]);
    if (res.ok) expect(importDataProblem(res.data)).toBeNull();
    expect(importDataProblem({ meta: { latest: 1 } })).toBe("dicts");
  });
});
