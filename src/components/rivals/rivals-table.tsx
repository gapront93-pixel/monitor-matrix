"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { compareHref } from "@/components/compare/compare-store";
import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { bestIndexes, type Better, type Comparable } from "@/lib/compare";
import { RIVAL_BRANDS, fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

const BRAND_LABEL: Record<string, string> = { Dell: "Dell/Alienware" };

type Col = { label: string; rank?: (p: Comparable) => number | null; better?: Better; show: (p: Comparable) => string; right?: boolean };

const COLS: Col[] = [
  { label: "Tấm nền", show: (p) => p.panel ?? "—" },
  { label: "Hz", rank: (p) => p.refreshHz, better: "high", show: (p) => (p.refreshHz ? String(p.refreshHz) : "—"), right: true },
  { label: "Phản hồi", rank: (p) => p.responseMs, better: "low", show: (p) => (p.responseMs !== null ? `${p.responseMs} ms` : "—"), right: true },
  { label: "SDR", rank: (p) => p.brightnessSdrNits, better: "high", show: (p) => (p.brightnessSdrNits ? String(p.brightnessSdrNits) : "—"), right: true },
  { label: "HDR", rank: (p) => p.brightnessHdrPeakNits, better: "high", show: (p) => (p.brightnessHdrPeakNits ? String(p.brightnessHdrPeakNits) : "—"), right: true },
  { label: "DCI-P3", rank: (p) => p.dciP3Pct, better: "high", show: (p) => (p.dciP3Pct !== null ? `${p.dciP3Pct}%` : "—"), right: true },
  {
    label: "USB-C",
    rank: (p) => (p.usbC === false ? 0 : p.usbCPdW),
    better: "high",
    show: (p) => (p.usbC === false ? "Không" : p.usbCPdW ? `${p.usbCPdW}W` : p.usbC ? "Có" : "—"),
    right: true,
  },
  { label: "Giá thấp nhất", rank: (p) => p.minPrice, better: "low", show: (p) => (p.minPrice ? fmtNum(p.minPrice) : "—"), right: true },
  { label: "Nơi bán", rank: (p) => (p.sellers ? p.inStock : null), better: "high", show: (p) => (p.sellers ? String(p.inStock) : "—"), right: true },
];

export function RivalsTable({ items }: { items: Comparable[] }) {
  const brands = useMemo(() => RIVAL_BRANDS.filter((b) => items.some((p) => p.brand === b)), [items]);
  const [hidden, setHidden] = useState<string[]>([]);
  const shown = items.filter((p) => p.isGigabyte || !hidden.includes(p.brand));
  const best = COLS.map((c) => (c.rank && c.better ? bestIndexes(shown.map(c.rank), c.better) : new Set<number>()));
  const gb = shown.filter((p) => p.isGigabyte);
  const rv = shown.filter((p) => !p.isGigabyte);
  const compare = [...gb.slice(0, 2), ...rv.slice(0, 4 - Math.min(2, gb.length))].slice(0, 4).map((p) => p.slug);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[12.5px] text-muted">Hãng</span>
        {brands.map((b) => (
          <Chip key={b} active={!hidden.includes(b)} onClick={() => setHidden((h) => (h.includes(b) ? h.filter((x) => x !== b) : [...h, b]))}>
            {BRAND_LABEL[b] ?? b}
          </Chip>
        ))}
        {compare.length >= 2 && (
          <ButtonLink href={compareHref(compare)} size="sm" className="ml-auto">
            So sánh phân khúc này
          </ButtonLink>
        )}
      </div>
      <div className="overflow-x-auto rounded-panel border border-line">
        <table className="w-full min-w-[860px] border-separate border-spacing-0 text-[12.5px]">
          <thead>
            <tr className="text-[11.5px] text-muted">
              <th scope="col" className="sticky left-0 z-10 w-[230px] border-r border-b border-line bg-head px-3 py-2 text-left font-semibold">
                Mẫu
              </th>
              {COLS.map((c) => (
                <th key={c.label} scope="col" className={cn("border-b border-line bg-head px-2.5 py-2 font-semibold", c.right ? "text-right" : "text-left")}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((p, i) => {
              const bg = i % 2 === 0 ? "bg-row-a" : "bg-row-b";
              return (
                <tr key={p.slug}>
                  <th
                    scope="row"
                    className={cn("sticky left-0 z-10 border-r border-b border-line-2 px-3 py-1.5 text-left font-normal", bg, p.isGigabyte && "shadow-[inset_3px_0_0_var(--color-accent)]")}
                  >
                    <div className={cn("text-[10.5px] font-bold tracking-[0.06em] uppercase", p.isGigabyte ? "text-brand-gb" : "text-muted")}>{p.brand}</div>
                    <Link href={`/san-pham/${encodeURIComponent(p.slug)}`} prefetch={false} className="text-[13px] font-bold text-fg hover:underline">
                      {p.model}
                    </Link>
                  </th>
                  {COLS.map((c, ci) => (
                    <td
                      key={c.label}
                      className={cn(
                        "num border-b border-line-2 px-2.5 py-1.5 text-[12px]",
                        c.right ? "text-right" : "text-left font-sans",
                        best[ci].has(i) ? "bg-best-bg font-semibold text-best" : cn(bg, "text-fg"),
                      )}
                    >
                      {c.show(p)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12px] text-muted">
        Ô xanh: giá trị tốt nhất của cột. Thông số đối thủ lấy từ trang chính hãng (hoặc bài review khi trang hãng bị chặn); mẫu đối thủ chưa có
        giá đại lý Việt Nam.
      </p>
    </>
  );
}

export function SegmentSelect({ segments, current }: { segments: { id: string; name: string }[]; current: string }) {
  const router = useRouter();
  return (
    <select
      aria-label="Phân khúc"
      value={current}
      onChange={(e) => router.push(`/doi-thu?pk=${e.target.value}`)}
      className="h-9 w-full rounded-ctl border border-line bg-app px-2.5 text-[13px] font-semibold text-fg md:hidden"
    >
      {segments.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
