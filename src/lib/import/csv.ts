import Papa from "papaparse";

/** CSV text to rows (Papa Parse): quoted fields, "" escapes, CRLF or LF, leading BOM, blank lines dropped */
export function parseCsv(text: string): string[][] {
  const { data } = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), { skipEmptyLines: "greedy" });
  return data.filter((r) => r.some((c) => c.trim() !== ""));
}
