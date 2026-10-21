"use client";

import Link from "next/link";

import { ProductImage } from "@/components/product-image";
import { COMPARE_FIELDS, bestIndexes, rowIsSame, type Comparable } from "@/lib/compare";
import { useT } from "@/lib/i18n/client";
import { catalogMessages } from "@/lib/i18n/messages/catalog";
import { cn } from "@/lib/utils";

/** Side by side table: one column per model, best value of each row in green */
export function CompareTable({
  items,
  diffOnly = false,
  onRemove,
  showImages = true,
}: {
  items: Comparable[];
  diffOnly?: boolean;
  onRemove?: (slug: string) => void;
  showImages?: boolean;
}) {
  const m = useT(catalogMessages);
  const fields = diffOnly ? COMPARE_FIELDS.filter((f) => !rowIsSame(f, items, m.words)) : COMPARE_FIELDS;
  return (
    <div className="overflow-x-auto rounded-panel border border-line">
      <table className="w-full border-separate border-spacing-0 text-[12.5px]" style={{ minWidth: 120 + items.length * 180 }}>
        <colgroup>
          <col className="w-[120px] md:w-[190px]" />
          {items.map((p) => (
            <col key={p.slug} className="min-w-[180px]" />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 border-r border-b border-line bg-head px-3 py-2.5 text-left align-bottom text-[11.5px] font-semibold text-muted">
              {m.compare.specs}
            </th>
            {items.map((p) => (
              <th key={p.slug} scope="col" className="border-r border-b border-line bg-head px-3 py-2.5 text-left align-top font-normal last:border-r-0">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className={cn("text-[11px] font-bold tracking-[0.06em] uppercase", p.isGigabyte ? "text-brand-gb" : "text-fg-2")}>{p.brand}</span>
                  {onRemove && (
                    <button
                      type="button"
                      onClick={() => onRemove(p.slug)}
                      aria-label={m.compare.remove(p.model)}
                      className="flex size-5 items-center justify-center rounded-chip border border-line text-[11px] text-muted hover:border-line-hover hover:text-fg"
                    >
                      ×
                    </button>
                  )}
                </div>
                {showImages && <ProductImage src={p.thumb} label={p.model} className="mb-2 hidden aspect-[16/10] w-full md:flex" />}
                <Link href={`/products/${encodeURIComponent(p.slug)}`} prefetch={false} className="text-[13px] leading-snug font-bold text-fg hover:underline">
                  {p.model}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fields.map((f, ri) => {
            const best = f.rank && f.better ? bestIndexes(items.map(f.rank), f.better) : new Set<number>();
            const bg = ri % 2 === 0 ? "bg-row-a" : "bg-row-b";
            return (
              <tr key={f.key}>
                <th scope="row" className={cn("sticky left-0 z-10 border-r border-b border-line-2 px-3 py-2 text-left font-normal text-fg-2", bg)}>
                  {m.fields[f.key]}
                </th>
                {items.map((p, i) => (
                  <td
                    key={p.slug}
                    className={cn(
                      "num border-r border-b border-line-2 px-3 py-2 text-right text-[12px] last:border-r-0",
                      best.has(i) ? "bg-best-bg font-semibold text-best" : cn(bg, "text-fg"),
                      f.key === "price" && !p.minPrice && "font-sans text-faint",
                    )}
                  >
                    {f.show(p, m.words)}
                  </td>
                ))}
              </tr>
            );
          })}
          {fields.length === 0 && (
            <tr>
              <td colSpan={items.length + 1} className="px-4 py-6 text-center text-[12.5px] text-muted">
                {m.compare.allSame}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
