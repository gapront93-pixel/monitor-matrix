import ExcelJS from "exceljs";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { userWith } from "@/lib/auth";
import { getCatalog } from "@/lib/catalog";
import { productsMessages } from "@/lib/i18n/messages/products";
import { getT } from "@/lib/i18n/server";
import { fmtDate, isoDay } from "@/lib/format";
import { isBuyable } from "@/lib/import/prices";
import { gridDealers, gridRows, hasPrice, isBestCell } from "@/lib/price-table";

export const runtime = "nodejs";

const Query = z.object({
  ngay: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  // Slugs in the order shown on screen (filtered + sorted); empty = every model with a price
  m: z.string().max(20_000).optional(),
});

// Excel is a light sheet: the screen colours are mapped to readable equivalents
const C = {
  bestFill: "FFC6EFCE",
  bestFont: "FF006100",
  gone: "FF8A9097",
  warn: "FFB7791F",
  wholesale: "FF6B7178",
  key: "FF1F6FD1",
  head: "FF121417",
  headFont: "FFE6E8EB",
  line: "FFD0D4D9",
};

const xlText = (s: string) => s.replace(/"/g, '""');

export async function GET(req: NextRequest) {
  if (!(await userWith("view"))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const t = (await getT(productsMessages)).xlsx;
  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return new Response(t.badParams, { status: 400 });
  const { ngay, m } = parsed.data;

  const catalog = await getCatalog(ngay);
  const dealers = gridDealers(catalog);
  const all = gridRows(catalog);
  let rows = all.filter(hasPrice);
  if (m) {
    const bySlug = new Map(all.map((r) => [r.slug, r]));
    rows = m
      .split(",")
      .map((s) => bySlug.get(s))
      .filter((r): r is NonNullable<typeof r> => !!r);
  }
  const day = ngay ?? (catalog.asOf ? isoDay(catalog.asOf) : isoDay(new Date()));

  const wb = new ExcelJS.Workbook();
  wb.creator = "GIGABYTE Monitor Matrix";
  wb.created = new Date();
  const ws = wb.addWorksheet(t.sheet, { views: [{ state: "frozen", xSplit: 2, ySplit: 1 }] });

  ws.columns = [
    { header: t.model, key: "model", width: 26 },
    { header: t.spec, key: "spec", width: 22 },
    ...dealers.map((d) => ({ header: d.wholesale ? t.wholesale(d.name) : d.name, key: d.id, width: 15 })),
    { header: t.lowest, key: "min", width: 15 },
    { header: t.lowestAt, key: "minAt", width: 24 },
    { header: t.inStock, key: "cnt", width: 15 },
  ];

  const header = ws.getRow(1);
  header.height = 30;
  header.eachCell((cell, i) => {
    const d = dealers[i - 3];
    cell.font = { bold: true, color: { argb: d?.isKey ? "FF6FA3EC" : C.headFont }, italic: d?.wholesale };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.head } };
    cell.alignment = { vertical: "middle", horizontal: i <= 2 ? "left" : "center", wrapText: true };
  });

  for (const r of rows) {
    const row = ws.addRow({
      model: r.model,
      spec: [r.spec, r.res].filter(Boolean).join(" · "),
      min: r.min ?? "",
      minAt: r.minDealers.join(", "),
      cnt: r.sellers ? `${r.inStock}/${r.sellers}` : "",
    });
    dealers.forEach((d, i) => {
      const c = r.cells[d.id];
      if (!c) return;
      const cell = row.getCell(3 + i);
      const gone = !isBuyable(c.s);
      if (c.p === null) {
        cell.value = c.link ? { text: t.contact, hyperlink: c.link } : t.contact;
        cell.font = { color: { argb: gone ? C.gone : C.warn }, strike: gone };
      } else {
        // HYPERLINK keeps the cell numeric (sortable, summable) and clickable
        cell.value = c.link && c.link.length < 250 ? { formula: `HYPERLINK("${xlText(c.link)}",${c.p})`, result: c.p } : c.p;
        cell.numFmt = "#,##0";
        const best = isBestCell(r, d, c);
        cell.font = {
          strike: gone,
          italic: d.wholesale,
          bold: best,
          color: { argb: best ? C.bestFont : gone ? C.gone : d.wholesale ? C.wholesale : "FF000000" },
        };
        if (best) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.bestFill } };
      }
      if (gone) cell.note = c.s === "discontinued" ? t.stop : t.out;
      cell.alignment = { horizontal: "right" };
    });
    const min = row.getCell("min");
    min.numFmt = "#,##0";
    min.font = { bold: true, color: { argb: C.bestFont } };
    row.getCell("cnt").alignment = { horizontal: "center" };
  }

  ws.eachRow((row) =>
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { bottom: { style: "thin", color: { argb: C.line } }, right: { style: "thin", color: { argb: C.line } } };
    }),
  );
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };

  ws.addRow([]);
  const notes = [t.title(fmtDate(new Date(`${day}T12:00:00+07:00`)), rows.length, dealers.length), t.legend, t.links];
  for (const n of notes) ws.addRow([n]).getCell(1).font = { color: { argb: "FF6B7178" }, size: 10 };

  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${t.file}-${day}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
