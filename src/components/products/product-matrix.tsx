"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { compareHref, MAX_COMPARE, useCompareList } from "@/components/compare/compare-store";
import { ProductImage } from "@/components/product-image";
import { Button, ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import type { Comparable } from "@/lib/compare";
import { fmtNum, resLabel, shortHdr } from "@/lib/format";
import { cn } from "@/lib/utils";

type Item = Comparable & { line: string | null };

const HZ = [
  { v: 0, label: "Tất cả" },
  { v: 180, label: "≥ 180Hz" },
  { v: 240, label: "≥ 240Hz" },
  { v: 360, label: "≥ 360Hz" },
];
const PRICE_MIN = 3;
const PRICE_MAX = 30; // = no limit
const LINE_ORDER = ["AORUS", "M", "G", "GS", "MO", "GO"];
const PANEL_ORDER = ["IPS", "VA", "WOLED", "QD-OLED", "OLED"];
const RES_ORDER = ["FHD", "QHD", "UWQHD", "4K", "DQHD"];

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);
const inch = (s: number | null) => (s === null ? "" : String(Math.round(s)));
const ordered = (vals: string[], order: string[]) =>
  [...new Set(vals)].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99) || a.localeCompare(b, "en", { numeric: true }));

type SortKey = "model" | "size" | "hz" | "ms" | "sdr" | "p3" | "pd" | "price" | "sellers";
const SORTS: Record<SortKey, (p: Item) => number | string | null> = {
  model: (p) => p.model,
  size: (p) => p.sizeIn,
  hz: (p) => p.refreshHz,
  ms: (p) => p.responseMs,
  sdr: (p) => p.brightnessSdrNits,
  p3: (p) => p.dciP3Pct,
  pd: (p) => p.usbCPdW,
  price: (p) => p.minPrice,
  sellers: (p) => p.sellers || null,
};

export function ProductMatrix({ items }: { items: Item[] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();

  const [lines, setLines] = useState(() => list(params.get("dong")));
  const [sizes, setSizes] = useState(() => list(params.get("inch")));
  const [panels, setPanels] = useState(() => list(params.get("tam-nen")));
  const [resos, setResos] = useState(() => list(params.get("do-phan-giai")));
  const [hz, setHz] = useState(() => Number(params.get("hz")) || 0);
  const [priceMax, setPriceMax] = useState(() => Math.min(PRICE_MAX, Math.max(PRICE_MIN, Number(params.get("gia-max")) || PRICE_MAX)));
  const [inStock, setInStock] = useState(params.get("con-hang") === "1");
  const [view, setView] = useState<"bang" | "the">(params.get("xem") === "the" ? "the" : "bang");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>(() => {
    const s = params.get("sap-xep") ?? "";
    const key = s.replace(/^-/, "") as SortKey;
    return key in SORTS ? { key, desc: s.startsWith("-") } : { key: "model", desc: false };
  });
  const [showFilters, setShowFilters] = useState(false);
  const [picked, setPicked] = useCompareList();

  // Filters live in the URL (no server round trip), so the link reopens the same view
  useEffect(() => {
    const p = new URLSearchParams();
    if (lines.length) p.set("dong", lines.join(","));
    if (sizes.length) p.set("inch", sizes.join(","));
    if (panels.length) p.set("tam-nen", panels.join(","));
    if (resos.length) p.set("do-phan-giai", resos.join(","));
    if (hz) p.set("hz", String(hz));
    if (priceMax < PRICE_MAX) p.set("gia-max", String(priceMax));
    if (inStock) p.set("con-hang", "1");
    if (view === "the") p.set("xem", "the");
    if (!(sort.key === "model" && !sort.desc)) p.set("sap-xep", (sort.desc ? "-" : "") + sort.key);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }, [lines, sizes, panels, resos, hz, priceMax, inStock, view, sort, pathname]);

  const options = useMemo(
    () => ({
      lines: ordered(items.map((p) => p.line ?? "").filter(Boolean), LINE_ORDER),
      sizes: [...new Set(items.map((p) => inch(p.sizeIn)).filter(Boolean))].sort((a, b) => Number(a) - Number(b)),
      panels: ordered(items.map((p) => p.panel ?? "").filter(Boolean), PANEL_ORDER),
      resos: ordered(items.map((p) => resLabel(p.resolution)).filter(Boolean), RES_ORDER),
    }),
    [items],
  );

  const shown = useMemo(() => {
    const out = items.filter(
      (p) =>
        (!lines.length || lines.includes(p.line ?? "")) &&
        (!sizes.length || sizes.includes(inch(p.sizeIn))) &&
        (!panels.length || panels.includes(p.panel ?? "")) &&
        (!resos.length || resos.includes(resLabel(p.resolution))) &&
        (!hz || (p.refreshHz ?? 0) >= hz) &&
        (priceMax >= PRICE_MAX || (p.minPrice !== null && p.minPrice <= priceMax * 1_000_000)) &&
        (!inStock || p.inStock > 0),
    );
    const get = SORTS[sort.key];
    return out.sort((a, b) => {
      const x = get(a), y = get(b);
      if (x === null && y === null) return 0;
      if (x === null) return 1; // missing values always last
      if (y === null) return -1;
      const c = typeof x === "string" ? x.localeCompare(String(y), "en", { numeric: true }) : x - (y as number);
      return sort.desc ? -c : c;
    });
  }, [items, lines, sizes, panels, resos, hz, priceMax, inStock, sort]);

  const activeCount = lines.length + sizes.length + panels.length + resos.length + (hz ? 1 : 0) + (priceMax < PRICE_MAX ? 1 : 0) + (inStock ? 1 : 0);
  const clear = () => {
    setLines([]);
    setSizes([]);
    setPanels([]);
    setResos([]);
    setHz(0);
    setPriceMax(PRICE_MAX);
    setInStock(false);
  };
  const toggleIn = (set: (f: (v: string[]) => string[]) => void, v: string) => set((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));

  const togglePick = (slug: string) => {
    if (picked.includes(slug)) setPicked(picked.filter((s) => s !== slug));
    else if (picked.length >= MAX_COMPARE) toast(`Chỉ so sánh tối đa ${MAX_COMPARE} mẫu`);
    else setPicked([...picked, slug]);
  };
  const bySlug = useMemo(() => new Map(items.map((p) => [p.slug, p])), [items]);
  const sortBy = (key: SortKey) => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key === "hz" || key === "sdr" || key === "p3" || key === "pd" || key === "sellers" }));

  return (
    <>
      <PageHeader
        eyebrow="Sản phẩm"
        title={
          <>
            Ma trận màn hình GIGABYTE <span className="num ml-1 text-[13px] font-normal text-muted">{shown.length} mẫu</span>
          </>
        }
        actions={
          <div className="flex overflow-hidden rounded-ctl border border-line" role="group" aria-label="Kiểu hiển thị">
            {(["bang", "the"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn("h-8 px-3.5 text-[12.5px] font-semibold", view === v ? "bg-fg text-app" : "bg-app text-fg-2 hover:text-fg")}
              >
                {v === "bang" ? "Bảng" : "Thẻ"}
              </button>
            ))}
          </div>
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <Button className="md:hidden" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
          Bộ lọc{activeCount ? ` (${activeCount})` : ""}
        </Button>
        <aside
          className={cn(
            "shrink-0 rounded-panel border border-line bg-panel p-3.5 md:sticky md:top-[70px] md:block md:w-[240px] xl:w-[260px]",
            showFilters ? "block" : "hidden",
          )}
          aria-label="Bộ lọc"
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[13px] font-bold text-fg">Bộ lọc</span>
            <button type="button" onClick={clear} className="text-[12px] text-muted hover:text-fg">
              Xoá bộ lọc
            </button>
          </div>
          <FilterGroup title="Dòng">
            {options.lines.map((v) => (
              <Chip key={v} active={lines.includes(v)} onClick={() => toggleIn(setLines, v)}>
                {v}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup title="Kích thước">
            {options.sizes.map((v) => (
              <Chip key={v} active={sizes.includes(v)} onClick={() => toggleIn(setSizes, v)}>
                {v}&quot;
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup title="Tấm nền">
            {options.panels.map((v) => (
              <Chip key={v} active={panels.includes(v)} onClick={() => toggleIn(setPanels, v)}>
                {v}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup title="Độ phân giải">
            {options.resos.map((v) => (
              <Chip key={v} active={resos.includes(v)} onClick={() => toggleIn(setResos, v)}>
                {v}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup title="Tần số quét">
            {HZ.map((h) => (
              <Chip key={h.v} active={hz === h.v} onClick={() => setHz(h.v)}>
                {h.label}
              </Chip>
            ))}
          </FilterGroup>
          <div className="mt-4">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="eyebrow">Khoảng giá</span>
              <span className="num text-[11.5px] text-fg-2">{priceMax >= PRICE_MAX ? "Không giới hạn" : `≤ ${priceMax} triệu`}</span>
            </div>
            <input
              type="range"
              min={PRICE_MIN}
              max={PRICE_MAX}
              step={1}
              value={priceMax}
              onChange={(e) => setPriceMax(Number(e.target.value))}
              aria-label="Giá tối đa (triệu đồng)"
              className="w-full accent-accent"
            />
            <div className="num flex justify-between text-[10.5px] text-faint">
              <span>{PRICE_MIN} tr</span>
              <span>{PRICE_MAX} tr+</span>
            </div>
          </div>
          <Switch className="mt-4 w-full justify-between" checked={inStock} onCheckedChange={setInStock} label={<span className="order-first">Chỉ mẫu còn hàng</span>} />
        </aside>

        <div className="min-w-0 flex-1">
          {shown.length === 0 ? (
            <EmptyState
              title="Không có mẫu nào khớp bộ lọc"
              action={
                <Button variant="primary" size="sm" onClick={clear}>
                  Xoá bộ lọc
                </Button>
              }
            >
              Bỏ bớt điều kiện lọc hoặc nới khoảng giá.
            </EmptyState>
          ) : view === "bang" ? (
            <MatrixTable items={shown} picked={picked} onPick={togglePick} sort={sort} onSort={sortBy} />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
              {shown.map((p) => (
                <ProductCard key={p.slug} p={p} picked={picked.includes(p.slug)} onPick={() => togglePick(p.slug)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {picked.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-3">
          <div className="flex max-w-full flex-wrap items-center gap-2 rounded-panel border border-line bg-panel px-3 py-2.5 shadow-float">
            <span className="text-[12.5px] text-muted">Đã chọn</span>
            {picked.map((s) => (
              <span key={s} className="flex h-7 items-center gap-1.5 rounded-chip border border-sel bg-sel-bg pr-1 pl-2 text-[12px] font-semibold text-fg">
                {bySlug.get(s)?.model ?? s}
                <button type="button" onClick={() => togglePick(s)} aria-label={`Bỏ chọn ${bySlug.get(s)?.model ?? s}`} className="px-1 text-muted hover:text-fg">
                  ×
                </button>
              </span>
            ))}
            <button type="button" onClick={() => setPicked([])} className="px-1 text-[12.5px] text-muted hover:text-fg">
              Bỏ chọn
            </button>
            {picked.length >= 2 ? (
              <ButtonLink href={compareHref(picked)} variant="primary" size="sm">
                So sánh ({picked.length})
              </ButtonLink>
            ) : (
              <span className="text-[12px] text-faint">Chọn thêm ít nhất 1 mẫu</span>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <div className="eyebrow mb-2">{title}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className="size-4 shrink-0 cursor-pointer accent-sel"
      onClick={(e) => e.stopPropagation()}
    />
  );
}

const COLS: { key: SortKey | null; label: string; w: string; right?: boolean }[] = [
  { key: "size", label: "Inch", w: "w-[56px]", right: true },
  { key: null, label: "Tấm nền", w: "w-[86px]" },
  { key: null, label: "Độ phân giải", w: "w-[84px]" },
  { key: "hz", label: "Hz", w: "w-[60px]", right: true },
  { key: "ms", label: "Phản hồi", w: "w-[76px]", right: true },
  { key: "sdr", label: "SDR / HDR nit", w: "w-[108px]", right: true },
  { key: "p3", label: "DCI-P3", w: "w-[72px]", right: true },
  { key: null, label: "Chuẩn HDR", w: "w-[118px]" },
  { key: null, label: "DP / HDMI", w: "w-[150px]" },
  { key: "pd", label: "USB-C PD", w: "w-[78px]", right: true },
  { key: "price", label: "Giá thấp nhất", w: "w-[126px]", right: true },
  { key: "sellers", label: "Nơi bán", w: "w-[72px]", right: true },
];

function MatrixTable({
  items,
  picked,
  onPick,
  sort,
  onSort,
}: {
  items: Item[];
  picked: string[];
  onPick: (slug: string) => void;
  sort: { key: SortKey; desc: boolean };
  onSort: (k: SortKey) => void;
}) {
  const arrow = (k: SortKey | null) => (k && sort.key === k ? <span className="ml-0.5 text-[10px] text-accent">{sort.desc ? "▼" : "▲"}</span> : null);
  return (
    <div className="max-h-[75vh] overflow-auto rounded-panel border border-line md:max-h-[calc(100vh-150px)]">
      <table className="border-separate border-spacing-0 text-[12.5px]" style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
        <colgroup>
          <col className="w-[150px] md:w-[240px]" />
          {COLS.map((c) => (
            <col key={c.label} className={c.w} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="sticky top-0 left-0 z-30 border-r border-b border-line bg-head px-3 py-2 text-left text-[11.5px] font-semibold text-muted">
              <button type="button" onClick={() => onSort("model")} className="font-semibold">
                Mẫu{arrow("model")}
              </button>
            </th>
            {COLS.map((c) => (
              <th
                key={c.label}
                scope="col"
                className={cn("sticky top-0 z-20 border-b border-line bg-head px-2 py-2 text-[11px] leading-tight font-semibold text-muted", c.right ? "text-right" : "text-left")}
              >
                {c.key ? (
                  <button type="button" onClick={() => onSort(c.key!)} className="font-semibold hover:text-fg">
                    {c.label}
                    {arrow(c.key)}
                  </button>
                ) : (
                  c.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((p, i) => {
            const sel = picked.includes(p.slug);
            const bg = sel ? "bg-sel-bg" : i % 2 === 0 ? "bg-row-a" : "bg-row-b";
            const td = cn("border-b border-line-2 px-2 py-1.5", bg);
            return (
              <tr key={p.slug} className="h-11">
                <td className={cn("sticky left-0 z-10 border-r border-b border-line-2 px-3 py-1.5", bg, sel && "shadow-[inset_3px_0_0_var(--color-sel)]")}>
                  <div className="flex items-center gap-2.5">
                    <Check checked={sel} onChange={() => onPick(p.slug)} label={`Chọn ${p.model} để so sánh`} />
                    <ProductImage src={p.thumb} className="hidden h-6 w-9 shrink-0 md:flex" sizes="40px" />
                    <div className="min-w-0">
                      <Link href={`/san-pham/${encodeURIComponent(p.slug)}`} prefetch={false} className="block text-[12.5px] leading-tight font-bold text-fg hover:underline">
                        {p.model}
                      </Link>
                      {p.line && <div className="text-[10.5px] text-faint">Dòng {p.line}</div>}
                    </div>
                  </div>
                </td>
                <td className={cn(td, "num text-right")}>{p.sizeIn ?? "—"}</td>
                <td className={td}>{p.panel ?? "—"}</td>
                <td className={td}>{resLabel(p.resolution) || "—"}</td>
                <td className={cn(td, "num text-right")}>{p.refreshHz ?? "—"}</td>
                <td className={cn(td, "num text-right")}>{p.responseMs !== null ? `${p.responseMs} ms` : "—"}</td>
                <td className={cn(td, "num text-right")}>
                  {p.brightnessSdrNits ?? "—"} / {p.brightnessHdrPeakNits ?? "—"}
                </td>
                <td className={cn(td, "num text-right")}>{p.dciP3Pct !== null ? `${p.dciP3Pct}%` : "—"}</td>
                <td className={cn(td, "truncate")} title={p.hdr ?? undefined}>
                  {shortHdr(p.hdr)}
                </td>
                <td className={cn(td, "num text-[11px] text-fg-2")}>
                  {[p.dpVer && `DP ${p.dpVer}`, p.hdmiVer && `HDMI ${p.hdmiVer}`].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className={cn(td, "num text-right")}>{p.usbCPdW ? `${p.usbCPdW}W` : p.usbC ? "Có" : "—"}</td>
                <td className={cn(td, "num text-right", p.minPrice ? "font-semibold text-best" : "font-sans text-[11.5px] text-faint")}>
                  {p.minPrice ? fmtNum(p.minPrice) : "Chưa có giá"}
                </td>
                <td className={cn(td, "num text-right text-fg-2")}>{p.sellers || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProductCard({ p, picked, onPick }: { p: Item; picked: boolean; onPick: () => void }) {
  return (
    <article className={cn("relative flex flex-col rounded-panel border bg-panel p-3", picked ? "border-sel" : "border-line hover:border-line-hover")}>
      <div className="absolute top-5 left-5 z-10 flex rounded-chip bg-app/80 p-1">
        <Check checked={picked} onChange={onPick} label={`Chọn ${p.model} để so sánh`} />
      </div>
      <ProductImage src={p.thumb} label={p.model} className="aspect-video w-full" />
      <Link href={`/san-pham/${encodeURIComponent(p.slug)}`} prefetch={false} className="mt-2.5 text-[14px] font-bold text-fg hover:underline">
        {p.model}
      </Link>
      <div className="mt-0.5 text-[11.5px] text-muted">
        {[p.sizeIn !== null && `${p.sizeIn}"`, p.panel, resLabel(p.resolution), p.refreshHz && `${p.refreshHz}Hz`, p.line && `Dòng ${p.line}`].filter(Boolean).join(" · ")}
      </div>
      <div className="mt-auto flex items-baseline justify-between pt-3">
        <span className={cn("num text-[14px] font-semibold", p.minPrice ? "text-best" : "font-sans text-[12px] font-normal text-faint")}>
          {p.minPrice ? fmtNum(p.minPrice) : "Chưa có giá"}
        </span>
        <span className="text-[11.5px] text-muted">{p.sellers ? `${p.sellers} nơi bán` : ""}</span>
      </div>
    </article>
  );
}
