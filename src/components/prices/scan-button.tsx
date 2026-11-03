"use client";

import { RefreshCwIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { fmtNum } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import { productsMessages } from "@/lib/i18n/messages/products";

// Mirrors ScanJob in lib/crawl/job.ts (kept apart: that module is server-only)
type Job = {
  id: number;
  by: string;
  state: "running" | "done" | "failed";
  progress: { total: number; done: number; dealer: string | null };
  error: string | null;
  result: {
    importId: number | null;
    dealers: number;
    pages: number;
    counts: { price: number; new: number; removed: number; stock: number; same: number };
    found: { dealer: string; model: string; price: number | null }[];
    problems: { dealer: string; model: string; url: string; reason: string }[];
    stale: { model: string; lastSale: string }[];
    sellOut: boolean;
  } | null;
};

const POLL_MS = 1500;

/** "Quét giá" on the price list: starts the scan, shows progress, then the result and reloads the table */
export function ScanButton() {
  const t = useT(productsMessages).scan;
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = job?.state === "running";

  // While a scan runs, ask for its progress; when it ends, reload the table
  useEffect(() => {
    if (!running) return;
    let alive = true;
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/prices/scan", { cache: "no-store" });
        if (!res.ok || !alive) return;
        const j = (await res.json()).job as Job | null;
        if (!alive) return;
        setJob(j);
        if (j?.state !== "running") router.refresh();
      } catch {
        // try again on the next tick
      }
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [running, router]);

  // A scan started earlier (another tab, another person) is picked up when the page opens
  useEffect(() => {
    let alive = true;
    fetch("/api/prices/scan", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || d?.job?.state !== "running") return;
        setJob(d.job);
        setOpen(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const start = async () => {
    if (!confirm(t.confirm)) return;
    setError(null);
    setOpen(true);
    try {
      const res = await fetch("/api/prices/scan", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      setJob((await res.json()).job);
    } catch {
      setError(t.failed);
    }
  };

  const p = job?.progress;
  const pct = p && p.total ? Math.min(100, Math.round((p.done / p.total) * 100)) : 0;
  const r = job?.result;

  return (
    <div className="relative">
      <Button variant="secondary" onClick={running ? () => setOpen(true) : start} title={t.hint} aria-busy={running}>
        <RefreshCwIcon className={running ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden />
        {running && p ? t.running(p.done, p.total) : t.button}
      </Button>

      {open && (job || error) && (
        <div
          role="status"
          aria-live="polite"
          className="absolute top-[calc(100%+8px)] left-0 z-50 w-[min(420px,calc(100vw-32px))] md:right-0 md:left-auto rounded-panel border border-line bg-panel p-4 text-[12.5px] shadow-float"
        >
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="text-[13.5px] font-semibold text-fg">
              {error ? t.failed : running ? t.title : job?.state === "failed" ? t.failed : r?.importId ? t.done : t.nothing}
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={t.close} className="text-faint hover:text-fg">
              <XIcon className="size-4" aria-hidden />
            </button>
          </div>

          {error && <p className="text-warn">{error}</p>}

          {running && p && (
            <>
              <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-muted">
                {p.dealer ? t.reading(p.dealer) : t.started(job.by)} · {p.done}/{p.total}
              </p>
              <p className="mt-1 text-faint">{t.hint}</p>
            </>
          )}

          {job?.state === "failed" && <p className="text-warn">{job.error}</p>}

          {job?.state === "done" && r && (
            <div className="space-y-2">
              <p className="text-fg-2">{t.summary(r.counts.price, r.counts.new, r.counts.removed, r.counts.stock, r.counts.same)}</p>
              <p className="text-faint">{t.meta(r.dealers, r.pages)}</p>
              {r.found.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-fg-2">{t.found(r.found.length)}</summary>
                  <ul className="mt-1 max-h-40 space-y-0.5 overflow-auto text-muted">
                    {r.found.map((f, i) => (
                      <li key={i}>
                        {f.model} · {f.dealer} · {f.price ? fmtNum(f.price) : "—"}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {r.problems.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-warn">{t.problems(r.problems.length)}</summary>
                  <ul className="mt-1 max-h-40 space-y-0.5 overflow-auto text-muted">
                    {r.problems.map((x, i) => (
                      <li key={i}>
                        <a href={x.url} target="_blank" rel="noopener noreferrer" className="hover:text-fg">
                          {x.model} · {x.dealer}
                        </a>{" "}
                        <span className="text-faint">({x.reason})</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {!r.sellOut ? (
                <p className="text-warn">{t.noSales}</p>
              ) : (
                r.stale.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-fg-2">{t.leftOut(r.stale.length)}</summary>
                    <ul className="mt-1 space-y-0.5 text-muted">
                      {r.stale.map((s) => (
                        <li key={s.model}>
                          {s.model} · {t.leftOutLast(s.lastSale)}
                        </li>
                      ))}
                    </ul>
                  </details>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
