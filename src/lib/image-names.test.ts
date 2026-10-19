import { describe, expect, it } from "vitest";

import { productIndex } from "./import/plan";
import { isPublicHttpUrl, matchFileName, modelKey } from "./image-names";

const idx = productIndex([
  { id: 1, slug: "MO27Q28G", model: "MO27Q28G", aliases: [] },
  { id: 2, slug: "AORUS-FO32U2P", model: "AORUS FO32U2P", aliases: [] },
  { id: 3, slug: "G34WQCP-rev-10", model: "G34WQCP (Rev. 1.0)", aliases: ["g34wqcp"] },
  { id: 4, slug: "G34WQCP-rev-20", model: "G34WQCP (Rev. 2.0)", aliases: ["g34wqcp"] },
  { id: 5, slug: "asus-rog-strix-oled-xg27aqwmg", model: "ROG Strix OLED XG27AQWMG", aliases: ["xg27aqwmg"] },
]);

describe("matchFileName", () => {
  it("matches by slug or model, any case and separator", () => {
    expect(matchFileName("MO27Q28G.jpg", idx)).toBe(1);
    expect(matchFileName("aorus-fo32u2p.PNG", idx)).toBe(2);
    expect(matchFileName("AORUS FO32U2P.webp", idx)).toBe(2);
    expect(matchFileName("XG27AQWMG.jpg", idx)).toBe(5);
  });
  it("ignores copy numbers added by Windows or cameras", () => {
    expect(matchFileName("MO27Q28G (1).jpg", idx)).toBe(1);
    expect(matchFileName("MO27Q28G_2.jpg", idx)).toBe(1);
    expect(matchFileName("MO27Q28G-1.jpg", idx)).toBe(1);
  });
  it("refuses ambiguous or unknown names", () => {
    expect(matchFileName("G34WQCP.jpg", idx)).toBeNull();
    expect(matchFileName("G34WQCP-rev-20.jpg", idx)).toBe(4);
    expect(matchFileName("IMG_2034.jpg", idx)).toBeNull();
  });
});

describe("modelKey", () => {
  it("picks the model code a page title must contain", () => {
    expect(modelKey("AORUS FO32U2P")).toBe("fo32u2p");
    expect(modelKey("G34WQCP (Rev. 2.0)")).toBe("g34wqcp");
    expect(modelKey("ROG Strix OLED XG27AQWMG")).toBe("xg27aqwmg");
  });
});

describe("isPublicHttpUrl", () => {
  it("allows public http(s) only", () => {
    expect(isPublicHttpUrl("https://cdn2.fptshop.com.vn/x.jpg")).toBe(true);
    for (const bad of ["http://127.0.0.1:5432/", "http://localhost:3003/", "http://10.0.0.5/a", "http://192.168.1.1/", "http://[::1]/", "file:///etc/passwd", "ftp://x.vn/a", "not a url"]) {
      expect(isPublicHttpUrl(bad)).toBe(false);
    }
  });
});
