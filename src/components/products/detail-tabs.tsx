"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { compareHref, MAX_COMPARE, useCompareList } from "@/components/compare/compare-store";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export type TabId = "thong-so" | "gia" | "doi-thu" | "benchmark";

/** Tabs with an orange underline; the open tab is kept in ?tab= */
export function DetailTabs({ tabs, initial }: { tabs: { id: TabId; label: string; content: ReactNode }[]; initial: TabId }) {
  const pathname = usePathname();
  const [tab, setTab] = useState<TabId>(tabs.some((t) => t.id === initial) ? initial : tabs[0].id);
  const open = (id: TabId) => {
    setTab(id);
    window.history.replaceState(null, "", id === tabs[0].id ? pathname : `${pathname}?tab=${id}`);
  };
  return (
    <>
      <div role="tablist" aria-label="Nội dung sản phẩm" className="no-scrollbar mb-4 flex overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => open(t.id)}
            className={cn(
              "relative h-10 shrink-0 px-3.5 text-[13px] font-semibold whitespace-nowrap",
              tab === t.id ? "text-fg" : "text-fg-2 hover:text-fg",
            )}
          >
            {t.label}
            {tab === t.id && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={tab !== t.id}>
          {t.content}
        </div>
      ))}
    </>
  );
}

export function AddToCompare({ slug }: { slug: string }) {
  const [list, setList] = useCompareList();
  const toast = useToast();
  const has = list.includes(slug);
  if (has) {
    return (
      <Link href={compareHref(list)} className="inline-flex h-[34px] items-center rounded-ctl border border-line bg-app px-4 text-[13px] font-semibold text-fg hover:border-line-hover">
        Đã có trong So sánh ({list.length})
      </Link>
    );
  }
  return (
    <Button
      onClick={() => {
        if (list.length >= MAX_COMPARE) return toast(`Chỉ so sánh tối đa ${MAX_COMPARE} mẫu`);
        setList([...list, slug]);
        toast("Đã thêm vào So sánh");
      }}
    >
      Thêm vào So sánh
    </Button>
  );
}
