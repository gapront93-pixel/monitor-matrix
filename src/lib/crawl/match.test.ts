import { describe, expect, it } from "vitest";

import { matchLink, pageLinks } from "./match";

const products = [
  { id: 1, model: "G27Q2" },
  { id: 2, model: "G27Q20" },
  { id: 3, model: "M27UP" },
  { id: 4, model: "M27UP ICE" },
  { id: 5, model: "AORUS FO27Q3" },
  { id: 6, model: "G34WQCP (Rev. 1.0)" },
  { id: 7, model: "G34WQCP (Rev. 2.0)" },
];

describe("matchLink", () => {
  it("matches whole model codes from the text or the URL", () => {
    expect(matchLink("Màn hình Gigabyte G27Q20 27 inch", "/p/1", products)).toBe(2);
    expect(matchLink("", "https://x.vn/man-hinh-gigabyte-g27q2-27inch", products)).toBe(1);
    expect(matchLink("AORUS FO27Q3 27\" OLED", "/a", products)).toBe(5);
  });
  it("prefers the most specific model and needs every word", () => {
    expect(matchLink("Gigabyte M27UP ICE trắng", "/a", products)).toBe(4);
    expect(matchLink("Gigabyte M27UP 4K", "/a", products)).toBe(3);
    expect(matchLink("FO27Q3 360Hz", "/a", products)).toBeNull(); // "aorus" missing
  });
  it("leaves revisions of one model unmatched", () => {
    expect(matchLink("Gigabyte G34WQCP", "/a", products)).toBeNull();
  });
});

describe("pageLinks", () => {
  it("keeps same-site links with their text and title", () => {
    const html = `<a href="/man-hinh-g27q20"><span>G27Q20</span></a><a href="https://other.vn/x">x</a><a href="tel:1">t</a><a title="M27UP" href="https://www.shop.vn/m27up#r">img</a>`;
    expect(pageLinks(html, "https://shop.vn/cat")).toEqual([
      { href: "https://shop.vn/man-hinh-g27q20", text: "G27Q20" },
      { href: "https://www.shop.vn/m27up", text: "img M27UP" },
    ]);
  });
});
