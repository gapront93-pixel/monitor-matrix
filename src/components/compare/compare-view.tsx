"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import type { Comparable } from "@/lib/compare";
import { useT } from "@/lib/i18n/client";
import { catalogMessages } from "@/lib/i18n/messages/catalog";
import { normKey } from "@/lib/normalize";
import { cn } from "@/lib/utils";

import { CompareTable } from "./compare-table";
import { compareHref, MAX_COMPARE, useCompareList } from "./compare-store";

type Choice = { slug: string; model: string; brand: string; spec: string };

export function CompareView({ items, choices }: { items: Comparable[]; choices: Choice[] }) {
  const t = useT(catalogMessages).compare;
  const router = useRouter();
  const [stored, setStored] = useCompareList();
  const [diffOnly, setDiffOnly] = useState(false);
  const slugs = items.map((i) => i.slug);
  const key = slugs.join(",");

  // The URL is the source of truth; the stored pick list follows it. With no ?m=, reopen the stored list.
  useEffect(() => {
    if (slugs.length) {
      if (stored.join(",") !== key) setStored(slugs);
    } else if (stored.length) router.replace(compareHref(stored));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the URL list changes
  }, [key]);

  const go = (next: string[]) => {
    setStored(next);
    router.push(next.length ? compareHref(next) : "/so-sanh");
  };

  return (
    <>
      <PageHeader
        eyebrow={t.title}
        title={items.length ? t.titleN(items.length) : t.titleEmpty}
        actions={
          <>
            <Switch checked={diffOnly} onCheckedChange={setDiffOnly} label={t.diffOnly} />
            {items.length >= MAX_COMPARE ? (
              <Button variant="muted" disabled>
                {t.max(MAX_COMPARE)}
              </Button>
            ) : (
              <AddModel choices={choices} exclude={slugs} onPick={(s) => go([...slugs, s])} />
            )}
          </>
        }
      />
      {items.length < 2 ? (
        <EmptyState
          title={t.needTwo}
          action={
            <ButtonLink href="/san-pham" variant="primary" size="sm">
              {t.pickInProducts}
            </ButtonLink>
          }
        >
          {items.length === 1
            ? t.oneSelected(items[0].model)
            : t.noneSelected}
        </EmptyState>
      ) : (
        <CompareTable items={items} diffOnly={diffOnly} onRemove={(s) => go(slugs.filter((x) => x !== s))} />
      )}
      {items.length === 1 && (
        <div className="mt-3">
          <CompareTable items={items} onRemove={(s) => go(slugs.filter((x) => x !== s))} showImages={false} />
        </div>
      )}
    </>
  );
}

function AddModel({ choices, exclude, onPick }: { choices: Choice[]; exclude: string[]; onPick: (slug: string) => void }) {
  const t = useT(catalogMessages).compare;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const list = useMemo(() => {
    const k = normKey(q);
    return choices.filter((c) => !exclude.includes(c.slug) && (!k || normKey(`${c.brand} ${c.model}`).includes(k))).slice(0, 60);
  }, [choices, exclude, q]);
  return (
    <div ref={box} className="relative">
      <Button variant="primary" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {t.add}
      </Button>
      {open && (
        <div className="absolute top-[calc(100%+6px)] right-0 z-50 w-[min(340px,calc(100vw-28px))] rounded-ctl border border-line bg-panel p-2 shadow-pop">
          <input
            autoFocus
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.filter}
            aria-label={t.filterLabel}
            className="mb-1.5 h-8 w-full rounded-ctl border border-line bg-app px-2.5 text-[13px] text-fg placeholder:text-faint"
          />
          <ul className="max-h-[320px] overflow-y-auto" role="listbox" aria-label={t.pick}>
            {list.length === 0 && <li className="px-2 py-2 text-[12.5px] text-muted">{t.noMatch}</li>}
            {list.map((c) => (
              <li key={c.slug}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setQ("");
                    onPick(c.slug);
                  }}
                  className="flex w-full flex-col items-start rounded-chip px-2 py-1.5 text-left hover:bg-row-a"
                >
                  <span className="text-[13px] font-semibold text-fg">
                    <span className={cn("mr-1.5 text-[11px] font-bold uppercase", c.brand === "GIGABYTE" ? "text-brand-gb" : "text-muted")}>{c.brand}</span>
                    {c.model}
                  </span>
                  <span className="text-[11px] text-faint">{c.spec}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
