"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { fmtNum } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import { shellMessages } from "@/lib/i18n/messages/shell";
import { cn } from "@/lib/utils";

type Hit = { slug: string; model: string; brand: string; spec: string; minPrice: number | null };

/** Type a model code: up to 7 matches, Enter or click opens the product */
export function QuickSearch({ className }: { className?: string }) {
  const t = useT(shellMessages).search;
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (!term) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tim-kiem?q=${encodeURIComponent(term)}`, { signal: ctl.signal });
        if (res.ok) {
          setHits((await res.json()).hits);
          setCursor(0);
        }
      } catch {
        // aborted or offline: keep the previous list
      }
    }, 120);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const go = (h: Hit) => {
    setOpen(false);
    setQ("");
    setHits([]);
    router.push(`/san-pham/${encodeURIComponent(h.slug)}`);
  };

  const shown = q.trim() ? hits : [];

  return (
    <div ref={box} className={cn("relative", className)}>
      <input
        type="search"
        role="combobox"
        aria-expanded={open && shown.length > 0}
        aria-controls={listId}
        aria-label={t.label}
        placeholder={t.placeholder}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setCursor((c) => Math.min(c + 1, shown.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setCursor((c) => Math.max(c - 1, 0));
          } else if (e.key === "Enter" && shown[cursor]) {
            e.preventDefault();
            go(shown[cursor]);
          } else if (e.key === "Escape") setOpen(false);
        }}
        className="h-8 w-full rounded-ctl border border-line bg-app px-2.5 text-[13px] text-fg placeholder:text-faint"
      />
      {open && q.trim() && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-[calc(100%+6px)] left-0 z-50 w-full min-w-[300px] overflow-hidden rounded-ctl border border-line bg-panel py-1 shadow-pop"
        >
          {shown.length === 0 && <li className="px-3 py-2.5 text-[12.5px] text-muted">{t.none(q.trim())}</li>}
          {shown.map((h, i) => (
            <li
              key={h.slug}
              role="option"
              aria-selected={i === cursor}
              onMouseEnter={() => setCursor(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                go(h);
              }}
              className={cn("flex cursor-pointer items-center gap-3 px-3 py-2", i === cursor && "bg-row-a")}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-fg">{h.model}</div>
                <div className="truncate text-[11px] text-muted">
                  <span className={h.brand === "GIGABYTE" ? "text-brand-gb" : undefined}>{h.brand}</span> · {h.spec}
                </div>
              </div>
              <div className={cn("num text-[12px] whitespace-nowrap", h.minPrice ? "text-best" : "text-faint")}>
                {h.minPrice ? fmtNum(h.minPrice) : t.noPrice}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
