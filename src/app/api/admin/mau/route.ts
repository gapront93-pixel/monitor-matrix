import { NextResponse, type NextRequest } from "next/server";

import { userWith } from "@/lib/auth";
import { getCatalog } from "@/lib/catalog";
import { isoDay } from "@/lib/format";
import { gridDealers, gridRows, hasPrice } from "@/lib/price-table";

export const runtime = "nodejs";

const csvCell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows: (string | number | null | undefined)[][]) => "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";

function file(body: string, name: string, type: string) {
  return new Response(body, { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
}

// Templates for the price upload, filled from the current prices so they are realistic
export async function GET(req: NextRequest) {
  const user = await userWith("prices");
  if (!user) return NextResponse.json({ error: "Bạn không có quyền cập nhật giá." }, { status: 403 });
  const loai = req.nextUrl.searchParams.get("loai");
  const catalog = await getCatalog();
  const dealers = gridDealers(catalog);
  const rows = gridRows(catalog).filter(hasPrice);
  const day = catalog.asOf ? isoDay(catalog.asOf) : isoDay(new Date());

  if (loai === "csv-doc") {
    // One price per line. status: ok | oos | contact
    const out: (string | number | null)[][] = [["model", "dealer", "price", "status", "url", "note"]];
    for (const r of rows.slice(0, 6)) {
      for (const d of dealers) {
        const c = r.cells[d.id];
        if (!c) continue;
        const status = c.p === null ? "contact" : c.s === "out_of_stock" || c.s === "discontinued" ? "oos" : "ok";
        out.push([r.slug, d.name, c.p, status, c.link, ""]);
      }
    }
    return file(csv(out), `mau-gia-theo-dong-${day}.csv`, "text/csv; charset=utf-8");
  }

  if (loai === "bang-gia") {
    // Same layout as data/bang-gia.csv: one column per dealer
    const out: (string | number | null)[][] = [["model", "slug", ...dealers.map((d) => d.name), "gia_thap_nhat", "so_noi_ban"]];
    for (const r of rows) {
      out.push([
        r.model,
        r.slug,
        ...dealers.map((d) => {
          const c = r.cells[d.id];
          if (!c) return "";
          if (c.p === null) return "Liên hệ";
          return c.s === "out_of_stock" || c.s === "discontinued" ? `${c.p} (Hết hàng)` : c.p;
        }),
        r.min,
        r.inStock,
      ]);
    }
    return file(csv(out), `bang-gia-${day}.csv`, "text/csv; charset=utf-8");
  }

  if (loai === "json") {
    // Same layout as data/prices/<dealer>.json, for one dealer
    const id = req.nextUrl.searchParams.get("dai-ly") ?? dealers[0]?.id;
    const d = catalog.dealers.find((x) => x.id === id);
    if (!d) return NextResponse.json({ error: "Không có đại lý này." }, { status: 404 });
    const items = gridRows(catalog)
      .filter((r) => r.cells[d.id])
      .map((r) => {
        const c = r.cells[d.id];
        return {
          slug: r.slug,
          name_on_site: r.model,
          price_vnd: c.p,
          list_price_vnd: null,
          url: c.link,
          note: c.p === null ? "Liên hệ" : c.s === "out_of_stock" ? "Hết hàng" : c.s === "discontinued" ? "Ngừng kinh doanh" : "",
        };
      });
    const body = { retailer: d.name, retailer_id: d.id, site: d.website, status: "ok", fetched: day, items };
    return file(JSON.stringify(body, null, 2), `${d.id}-${day}.json`, "application/json; charset=utf-8");
  }

  return NextResponse.json({ error: "loai phải là csv-doc, bang-gia hoặc json" }, { status: 400 });
}
