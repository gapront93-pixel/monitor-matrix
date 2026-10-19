"use client";

import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import { fmtNum, fmtPriceCell } from "@/lib/format";
import { isBuyable } from "@/lib/import/prices";
import { useT } from "@/lib/i18n/client";
import { productsMessages } from "@/lib/i18n/messages/products";
import { hasPrice, isBestCell, matchesQuery, type GridDealer, type GridRow } from "@/lib/price-table";
import { cn } from "@/lib/utils";

const ROW_H = 37;
const VIRTUAL_FROM = 100; // rows

type Props = {
  rows: GridRow[];
  dealers: GridDealer[];
  days: { value: string; label: string }[];
  day: string;
  isHistory: boolean;
  dayLabel: string;
};

const col = createColumnHelper<GridRow>();

function parseSort(v: string | null): SortingState {
  if (!v) return [{ id: "model", desc: false }];
  return [{ id: v.replace(/^-/, ""), desc: v.startsWith("-") }];
}

const selectCls = "h-8 rounded-ctl border border-line bg-app px-2 text-[13px] text-fg";

export function PriceGrid({ rows, dealers, days, day, isHistory, dayLabel }: Props) {
  const t = useT(productsMessages).prices;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [panel, setPanel] = useState(params.get("tam-nen") ?? "");
  const [size, setSize] = useState(params.get("kich-thuoc") ?? "");
  const [onlyPriced, setOnlyPriced] = useState(params.get("co-gia") !== "0");
  const [sorting, setSorting] = useState<SortingState>(() => parseSort(params.get("sap-xep")));
  const [selected, setSelected] = useState<string | null>(null);

  // Keep the view in the URL without a server round trip, so a link reopens the same table
  useEffect(() => {
    const p = new URLSearchParams();
    if (isHistory) p.set("ngay", day);
    if (q.trim()) p.set("q", q.trim());
    if (panel) p.set("tam-nen", panel);
    if (size) p.set("kich-thuoc", size);
    if (!onlyPriced) p.set("co-gia", "0");
    const s = sorting[0];
    if (s && !(s.id === "model" && !s.desc)) p.set("sap-xep", (s.desc ? "-" : "") + s.id);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }, [q, panel, size, onlyPriced, sorting, isHistory, day, pathname]);

  const panels = useMemo(() => [...new Set(rows.map((r) => r.panel).filter(Boolean))].sort() as string[], [rows]);
  const sizes = useMemo(() => [...new Set(rows.map((r) => r.size).filter((s) => s !== null))].sort((a, b) => a! - b!) as number[], [rows]);

  const data = useMemo(
    () =>
      rows.filter(
        (r) =>
          matchesQuery(r, q) && (!panel || r.panel === panel) && (!size || String(r.size) === size) && (!onlyPriced || hasPrice(r)),
      ),
    [rows, q, panel, size, onlyPriced],
  );

  const columns = useMemo(
    () => [
      col.accessor("model", { id: "model", sortingFn: "alphanumeric" }),
      ...dealers.map((d) =>
        col.accessor((r) => r.cells[d.id]?.p ?? undefined, { id: d.id, sortUndefined: "last", sortDescFirst: false }),
      ),
      col.accessor((r) => r.min ?? undefined, { id: "min", sortUndefined: "last", sortDescFirst: false }),
      col.accessor("inStock", { id: "cnt", sortDescFirst: true }),
    ],
    [dealers],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns new functions each render by design
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSortingRemoval: false,
  });
  const sorted = table.getRowModel().rows;

  const scroller = useRef<HTMLDivElement>(null);
  const virtual = sorted.length > VIRTUAL_FROM;
  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_H,
    overscan: 12,
    enabled: virtual,
  });
  const items = virtual ? virtualizer.getVirtualItems() : null;
  // Stripes follow the sorted position, not the original order
  const visible = items ? items.map((i) => ({ row: sorted[i.index], pos: i.index })) : sorted.map((row, pos) => ({ row, pos }));
  const padTop = items?.length ? items[0].start : 0;
  const padBottom = items?.length ? virtualizer.getTotalSize() - items[items.length - 1].end : 0;

  const sortBy = (id: string) => {
    const cur = sorting[0];
    const column = table.getColumn(id);
    const firstDesc = column?.columnDef.sortDescFirst ?? false;
    setSorting([{ id, desc: cur?.id === id ? !cur.desc : firstDesc }]);
  };

  const changeDay = (v: string) => {
    const p = new URLSearchParams(window.location.search);
    if (v === days[0]?.value) p.delete("ngay");
    else p.set("ngay", v);
    router.push(`${pathname}${p.size ? `?${p}` : ""}`);
  };

  const exportXlsx = () => {
    const p = new URLSearchParams();
    if (isHistory) p.set("ngay", day);
    p.set("m", sorted.map((r) => r.original.slug).join(","));
    // A file download, not a page: a temporary <a download> keeps the current page
    const a = document.createElement("a");
    a.href = `/api/bang-gia/xlsx?${p}`;
    a.download = "";
    document.body.append(a);
    a.click();
    a.remove();
  };

  const clearFilters = () => {
    setQ("");
    setPanel("");
    setSize("");
    setOnlyPriced(false);
  };

  const arrow = (id: string) => {
    const s = sorting[0];
    if (s?.id !== id) return null;
    return <span className="ml-1 text-[10px] text-accent">{s.desc ? "▼" : "▲"}</span>;
  };

  const colCount = dealers.length + 3;

  return (
    <>
      <PageHeader
        eyebrow={t.title}
        title={t.heading}
        sub={t.sub(dayLabel, data.length, dealers.length)}
        actions={
          <Button variant="primary" onClick={exportXlsx} disabled={!data.length}>
            {t.export}
          </Button>
        }
      />

      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.search}
          aria-label={t.searchLabel}
          className={cn(selectCls, "w-full px-2.5 placeholder:text-faint md:w-[260px]")}
        />
        <select aria-label={t.panel} value={panel} onChange={(e) => setPanel(e.target.value)} className={selectCls}>
          <option value="">{t.panelAll}</option>
          {panels.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select aria-label={t.size} value={size} onChange={(e) => setSize(e.target.value)} className={selectCls}>
          <option value="">{t.sizeAll}</option>
          {sizes.map((s) => (
            <option key={s} value={String(s)}>
              {s}&quot;
            </option>
          ))}
        </select>
        <Switch checked={onlyPriced} onCheckedChange={setOnlyPriced} label={t.onlyPriced} />
        <label className="flex h-8 items-center gap-2 rounded-ctl border border-line bg-app pl-2.5 text-[13px] text-muted">
          {t.day}
          <select
            aria-label={t.day}
            value={day}
            onChange={(e) => changeDay(e.target.value)}
            className="num h-full rounded-r-ctl bg-app pr-1 text-[12px] text-fg"
          >
            {days.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Legend />

      {isHistory && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-panel border border-warn-line bg-warn-bg px-3.5 py-2.5 text-[12.5px] text-warn">
          <span>{t.history(dayLabel)}</span>
          <button
            type="button"
            onClick={() => changeDay(days[0].value)}
            className="h-7 rounded-ctl border border-warn-line px-2.5 font-semibold text-fg hover:border-warn"
          >
            {t.today}
          </button>
        </div>
      )}

      {data.length === 0 ? (
        <EmptyState
          title={t.none}
          action={
            <Button variant="primary" size="sm" onClick={clearFilters}>
              {t.clear}
            </Button>
          }
        >
          {t.noneText}
        </EmptyState>
      ) : (
        <div ref={scroller} className="max-h-[70vh] overflow-auto rounded-panel border border-line md:max-h-[calc(100vh-280px)]">
          <table className="border-separate border-spacing-0 text-[12px]" style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
            <colgroup>
              <col className="w-[132px] md:w-[230px]" />
              {dealers.map((d) => (
                <col key={d.id} className="w-[122px]" />
              ))}
              <col className="w-[132px]" />
              <col className="w-[96px]" />
            </colgroup>
            <thead>
              <tr>
                <Th sticky onClick={() => sortBy("model")} className="text-left">
                  <span className="text-[12px] font-bold text-fg">{t.model}</span>
                  {arrow("model")}
                </Th>
                {dealers.map((d) => (
                  <Th key={d.id} onClick={() => sortBy(d.id)} title={t.sortBy(d.name)}>
                    <div className={cn("truncate text-[11.5px] font-bold", d.isKey ? "text-key" : "text-fg")}>
                      {d.name}
                      {arrow(d.id)}
                    </div>
                    <div className={cn("text-[10px] font-normal text-faint", d.wholesale && "italic")}>
                      {d.wholesale ? t.wholesale : d.isKey ? t.key : t.retail}
                    </div>
                  </Th>
                ))}
                <Th onClick={() => sortBy("min")} className="bg-sum-a">
                  <span className="text-[11.5px] font-bold text-fg">{t.lowest}</span>
                  {arrow("min")}
                </Th>
                <Th onClick={() => sortBy("cnt")} className="bg-sum-a">
                  <span className="text-[11.5px] font-bold text-fg">{t.inStock}</span>
                  {arrow("cnt")}
                </Th>
              </tr>
            </thead>
            <tbody>
              {padTop > 0 && (
                <tr aria-hidden>
                  <td colSpan={colCount} style={{ height: padTop }} />
                </tr>
              )}
              {visible.map(({ row, pos }) => {
                const r = row.original;
                const odd = pos % 2 === 0;
                const isSel = selected === r.slug;
                const rowBg = isSel ? "bg-sel-bg" : odd ? "bg-row-a" : "bg-row-b";
                return (
                  <tr key={r.slug} style={{ height: ROW_H }} aria-selected={isSel}>
                    <td
                      onClick={() => setSelected(isSel ? null : r.slug)}
                      className={cn(
                        "sticky left-0 z-10 cursor-pointer border-r border-b border-line-2 px-2.5 py-1.5",
                        rowBg,
                        isSel && "shadow-[inset_3px_0_0_var(--color-sel)]",
                      )}
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/san-pham/${encodeURIComponent(r.slug)}?tab=gia`}
                          prefetch={false}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[12.5px] leading-tight font-bold break-words text-fg hover:underline"
                        >
                          {r.model}
                        </Link>
                        <span className="hidden text-[10.5px] leading-tight whitespace-nowrap text-faint md:block">{r.spec}</span>
                      </div>
                    </td>
                    {dealers.map((d) => (
                      <PriceTd key={d.id} row={r} dealer={d} rowBg={rowBg} />
                    ))}
                    <td className={cn("border-r border-b border-line-2 px-2.5 py-1 text-right", isSel ? "bg-sel-bg" : odd ? "bg-sum-a" : "bg-sum-b")}>
                      {r.min !== null ? (
                        <>
                          <div className="num text-[12px] font-semibold text-best">{fmtNum(r.min)}</div>
                          <div className="truncate text-[10px] text-faint" title={r.minDealers.join(", ")}>
                            {r.minDealers[0]}
                            {r.minDealers.length > 1 && ` +${r.minDealers.length - 1}`}
                          </div>
                        </>
                      ) : (
                        <span className="text-empty">—</span>
                      )}
                    </td>
                    <td className={cn("num border-b border-line-2 px-2.5 text-right text-[12px] text-fg-2", isSel ? "bg-sel-bg" : odd ? "bg-sum-a" : "bg-sum-b")}>
                      {r.sellers ? (
                        <span title={t.inStockTitle(r.inStock, r.sellers)}>
                          {r.inStock}/{r.sellers}
                        </span>
                      ) : (
                        <span className="text-empty">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {padBottom > 0 && (
                <tr aria-hidden>
                  <td colSpan={colCount} style={{ height: padBottom }} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2.5 max-w-[90ch] text-[12px] leading-relaxed text-muted">
        {t.note}
      </p>
    </>
  );
}

function Th({
  children,
  sticky,
  className,
  onClick,
  title,
}: {
  children: ReactNode;
  sticky?: boolean;
  className?: string;
  onClick: () => void;
  title?: string;
}) {
  return (
    <th
      scope="col"
      title={title}
      className={cn(
        "sticky top-0 cursor-pointer border-r border-b border-line bg-head px-2.5 py-2 text-right align-bottom leading-tight select-none hover:bg-panel",
        sticky ? "left-0 z-30" : "z-20",
        className,
      )}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick())}
      tabIndex={0}
    >
      {children}
    </th>
  );
}

function PriceTd({ row, dealer, rowBg }: { row: GridRow; dealer: GridDealer; rowBg: string }) {
  const t = useT(productsMessages).prices;
  const c = row.cells[dealer.id];
  const base = "num border-r border-b border-line-2 px-2.5 py-1 text-right text-[12px] whitespace-nowrap";
  if (!c) {
    return (
      <td className={cn(base, rowBg)}>
        <span className="text-empty">—</span>
      </td>
    );
  }
  const best = isBestCell(row, dealer, c);
  const gone = !isBuyable(c.s);
  const text = c.p !== null ? fmtPriceCell(c.p) : t.contact;
  const inner = (
    <span
      className={cn(
        c.p === null && !gone && "font-sans text-warn",
        gone && "text-faint-2 line-through",
        !gone && dealer.wholesale && c.p !== null && "text-wholesale italic",
        best && "font-semibold text-best",
        !best && !gone && !dealer.wholesale && c.p !== null && "text-fg",
      )}
    >
      {text}
    </span>
  );
  return (
    <td className={cn(base, best ? "bg-best-solid" : rowBg)}>
      {c.link ? (
        <a href={c.link} target="_blank" rel="noopener noreferrer" title={c.title ?? undefined} className="hover:underline">
          {inner}
        </a>
      ) : (
        <span title={c.title ?? undefined}>{inner}</span>
      )}
      {gone && (
        <span className="mt-0.5 ml-auto block w-fit rounded-tag bg-warn px-1 font-sans text-[9.5px] leading-[14px] font-bold text-app">
          {c.s === "discontinued" ? t.stopTag : t.outTag}
        </span>
      )}
    </td>
  );
}

function Legend() {
  const t = useT(productsMessages).prices;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
      <span>
        <span className="num text-best">[ 0 ]</span> {t.legendLowest}
      </span>
      <span>
        <span className="num text-faint-2 line-through">[ 0 ]</span> <span className="text-warn">{t.legendOut}</span>
      </span>
      <span className="text-warn">{t.contact}</span>
      <span className="text-wholesale italic">{t.legendWholesale}</span>
      <span className="text-key">{t.legendKey}</span>
    </div>
  );
}
