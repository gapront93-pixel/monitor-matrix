// Maps the model codes of vnpromotion sales rows (SKUs) to catalog products. Pure (tested in sales-map.test.ts).
import { normKey } from "./normalize";

/**
 * Candidate model codes for a sales row, best first:
 * "GAGS24F14_EK1" -> GS24F14, "GS27FABT1" -> GS27FA, "G27Q20T EK" -> G27Q20T, "GAG25F2A_EK1" -> G25F2A.
 * soModel (filled for part of the rows) is the cleanest and goes first.
 */
export function saleCandidates(model: string | null, soModel: string | null): string[] {
  const out: string[] = [];
  const add = (v: string | null | undefined) => {
    const k = v ? normKey(v) : "";
    if (k && !out.includes(k)) out.push(k);
  };
  add(soModel);
  if (model) {
    let m = model.trim();
    m = m.replace(/[_\s-]*EK\d*$/i, ""); // _EK1, " EK"
    m = m.replace(/[_\s-]*BT\d$/i, ""); // GS27FABT1
    add(m);
    if (/^GA(?=(G|GS|M|MO|GO|FO|FI|KD|AORUS))/i.test(m)) add(m.slice(2)); // GA + model code
    add(model);
  }
  return out;
}

/**
 * Product for a sales row. A code shared by revisions of one model ("G34WQCP" = Rev. 1.0 and Rev. 2.0)
 * goes to the newest revision; any other ambiguity stays unmatched.
 */
export function matchSale(
  model: string | null,
  soModel: string | null,
  idx: Map<string, number[]>,
  modelOf: (id: number) => string = () => "",
): number | null {
  for (const c of saleCandidates(model, soModel)) {
    const ids = idx.get(c);
    if (!ids?.length) continue;
    if (ids.length === 1) return ids[0];
    const base = (id: number) => modelOf(id).replace(/\s*\(Rev\.?\s*[\d.]+\)\s*$/i, "");
    const rev = (id: number) => Number(modelOf(id).match(/\(Rev\.?\s*([\d.]+)\)/i)?.[1] ?? NaN);
    if (ids.every((id) => base(id) && base(id) === base(ids[0]) && !Number.isNaN(rev(id)))) {
      return [...ids].sort((a, b) => rev(b) - rev(a))[0];
    }
    return null;
  }
  return null;
}
