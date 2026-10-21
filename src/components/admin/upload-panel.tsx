"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Panel } from "@/components/ui/panel";
import { ErrorState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import type { PreviewItem, UploadPreview } from "@/lib/admin-upload";
import { fmtDiff, fmtNum } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import { adminMessages } from "@/lib/i18n/messages/admin";
import { cn } from "@/lib/utils";

import type { AdminDealer } from "./types";

type Filter = "all" | PreviewItem["kind"];

const FILTERS: { id: Filter; tone: string }[] = [
  { id: "all", tone: "text-fg-2" },
  { id: "up", tone: "text-up" },
  { id: "down", tone: "text-best" },
  { id: "new", tone: "text-key" },
  { id: "stock", tone: "text-fg-2" },
  { id: "removed", tone: "text-fg-2" },
  { id: "error", tone: "text-warn" },
];

const isoToVn = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

export function UploadPanel({ dealers }: { dealers: AdminDealer[] }) {
  const t = useT(adminMessages).upload;
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [day, setDay] = useState("");
  const [keepMissing, setKeepMissing] = useState(false);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState<"reading" | "applying" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(200);

  const send = async (url: string, f: File, opts: { day: string; keepMissing: boolean }) => {
    const form = new FormData();
    form.set("file", f);
    if (opts.day) form.set("ngay", opts.day);
    if (opts.keepMissing) form.set("giu-gia-cu", "1");
    const res = await fetch(url, { method: "POST", body: form });
    const body = await res.json().catch(() => ({ error: t.badResponse }));
    if (!res.ok) throw new Error(body.error ?? t.httpError(res.status));
    return body;
  };

  const read = async (f: File, opts = { day, keepMissing }) => {
    setFile(f);
    setError(null);
    setPreview(null);
    setFilter("all");
    setLimit(200);
    if (!/\.(csv|json)$/i.test(f.name)) return setError(t.onlyCsvJson);
    setBusy("reading");
    try {
      setPreview(await send("/api/admin/uploads", f, opts));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.unreadable);
    } finally {
      setBusy(null);
    }
  };

  const apply = async () => {
    if (!file || !preview) return;
    setBusy("applying");
    try {
      const r = await send("/api/admin/uploads/apply", file, { day, keepMissing });
      toast(t.applied(r.applied, isoToVn(r.day), r.importId));
      reset();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.saveFailed);
    } finally {
      setBusy(null);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    if (input.current) input.current.value = "";
  };

  const items = preview ? preview.items.filter((i) => filter === "all" || i.kind === filter) : [];
  const changed = preview ? preview.items.filter((i) => i.kind !== "error").length : 0;

  return (
    <section aria-labelledby="upload-title">
      <h2 id="upload-title" className="mb-2 text-[18px] font-bold text-fg">
        {t.title}
      </h2>

      {!preview && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files[0];
            if (f) read(f);
          }}
          className={cn(
            "flex flex-col items-center rounded-box border border-dashed px-6 py-8 text-center transition-colors",
            drag ? "border-accent bg-panel" : "border-line-dashed",
          )}
        >
          {busy === "reading" ? (
            <div aria-live="polite" className="text-[13px] text-fg-2">
              {t.reading(file?.name ?? "")}
            </div>
          ) : (
            <>
              <div className="text-[14px] font-bold text-fg">{t.drop}</div>
              <p className="mt-1 max-w-[70ch] text-[12.5px] leading-relaxed text-muted">{t.help}</p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button variant="primary" onClick={() => input.current?.click()}>
                  {t.choose}
                </Button>
                <a className="h-8 content-center rounded-ctl border border-line px-3 text-[12.5px] font-semibold text-fg hover:border-line-hover" href="/api/admin/template?loai=csv-doc">
                  {t.tplLong}
                </a>
                <a className="h-8 content-center rounded-ctl border border-line px-3 text-[12.5px] font-semibold text-fg hover:border-line-hover" href="/api/admin/template?loai=bang-gia">
                  {t.tplTable}
                </a>
                <a className="h-8 content-center rounded-ctl border border-line px-3 text-[12.5px] font-semibold text-fg hover:border-line-hover" href="/api/admin/template?loai=json">
                  {t.tplJson}
                </a>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12.5px] text-fg-2">
                <label className="flex items-center gap-2">
                  {t.day}
                  <input
                    type="date"
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
                    className="num h-8 rounded-ctl border border-line bg-app px-2 text-[12px] text-fg"
                  />
                  <span className="text-[11.5px] text-faint">{t.dayHint}</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={keepMissing} onChange={(e) => setKeepMissing(e.target.checked)} className="size-4 accent-sel" />
                  {t.keep}
                </label>
              </div>
            </>
          )}
          <input
            ref={input}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) read(f);
            }}
          />
        </div>
      )}

      {error && (
        <div className="mt-3">
          <ErrorState
            title={t.cannotUse}
            action={
              <Button size="sm" onClick={reset}>
                {t.other}
              </Button>
            }
          >
            {error}
          </ErrorState>
        </div>
      )}

      {preview && (
        <>
          <Panel className="mb-3 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="num truncate text-[13px] font-semibold text-fg">{preview.fileName}</div>
              <div className="text-[12px] text-muted">
                {t.summary((preview.size / 1024).toFixed(1), t.formats[preview.format], preview.rows, isoToVn(preview.day))}
                {preview.dayFromFile && t.fromFile}
                {t.changed(changed)}
                {preview.previousDay ? t.vsPrev(isoToVn(preview.previousDay)) : t.noPrev}
              </div>
              <div className="mt-1 text-[12px] text-fg-2">
                {t.dealersIn}{" "}
                {preview.dealers.map((d, i) => (
                  <span key={d.id}>
                    {i > 0 && ", "}
                    {d.name}
                    {d.isNew && <span className="text-key">{t.newDealer}</span>}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={reset} disabled={busy === "applying"}>
                {t.cancel}
              </Button>
              <Button variant="primary" onClick={apply} disabled={busy === "applying" || preview.applicable === 0}>
                {busy === "applying" ? t.saving : t.apply(preview.applicable)}
              </Button>
            </div>
          </Panel>

          {preview.counts.removed > 0 && !preview.keepMissing && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-panel border border-warn-line bg-warn-bg px-3.5 py-2.5 text-[12.5px] text-warn">
              <span>
                {t.removedWarn(preview.counts.removed)}
              </span>
              <button
                type="button"
                onClick={() => {
                  setKeepMissing(true);
                  if (file) read(file, { day, keepMissing: true });
                }}
                className="h-7 rounded-ctl border border-warn-line px-2.5 font-semibold text-fg hover:border-warn"
              >
                {t.keepButton}
              </button>
            </div>
          )}

          <div className="mb-3 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const n = f.id === "all" ? preview.items.length : preview.counts[f.id];
              if (f.id !== "all" && !n) return null;
              return (
                <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
                  {t.filters[f.id]}
                  <span className={cn("num ml-1.5 text-[11px]", filter === f.id ? "text-app" : f.tone)}>{n}</span>
                </Chip>
              );
            })}
            {preview.counts.same > 0 && <span className="self-center text-[12px] text-faint">{t.same(preview.counts.same)}</span>}
          </div>

          {items.length === 0 ? (
            <p className="rounded-panel border border-line px-4 py-6 text-center text-[12.5px] text-muted">
              {t.noChange}
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-auto rounded-panel border border-line">
              <table className="w-full min-w-[820px] border-separate border-spacing-0 text-[12.5px]">
                <thead>
                  <tr className="text-[11.5px] text-muted">
                    {t.cols.map((h, i) => (
                      <th key={h} scope="col" className={cn("sticky top-0 border-b border-line bg-head px-3 py-2 font-semibold", i >= 2 && i <= 5 ? "text-right" : "text-left")}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.slice(0, limit).map((it, i) => {
                    const bg = i % 2 === 0 ? "bg-row-a" : "bg-row-b";
                    const td = cn("border-b border-line-2 px-3 py-2", bg);
                    const up = it.diff !== null && it.diff > 0;
                    const down = it.diff !== null && it.diff < 0;
                    return (
                      <tr key={i}>
                        <td className={cn(td, "font-semibold text-fg")}>{it.model || "—"}</td>
                        <td className={cn(td, "text-fg-2")}>{it.dealer || "—"}</td>
                        <td className={cn(td, "num text-right text-muted")}>{it.before !== null ? fmtNum(it.before) : "—"}</td>
                        <td className={cn(td, "num text-right text-fg")}>{it.after !== null ? fmtNum(it.after) : it.kind === "removed" ? "—" : it.kind === "error" ? "" : t.contact}</td>
                        <td className={cn("num border-b border-line-2 px-3 py-2 text-right", up ? "bg-up-bg text-up" : down ? "bg-best-bg text-best" : bg)}>
                          {it.diff !== null ? fmtDiff(it.diff) : ""}
                        </td>
                        <td className={cn(td, "num text-right", up ? "text-up" : down ? "text-best" : "text-muted")}>{it.pct !== null ? `${it.pct > 0 ? "+" : ""}${it.pct.toFixed(1)}%` : ""}</td>
                        <td className={cn(td, it.kind === "error" ? "text-warn" : it.kind === "new" ? "text-key" : "text-muted")}>{it.note}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {items.length > limit && (
                <div className="flex justify-center border-t border-line bg-panel py-2">
                  <Button size="sm" onClick={() => setLimit((l) => l + 300)}>
                    {t.more(items.length - limit)}
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
      <p className="mt-2 text-[11.5px] text-faint">{t.tracking(dealers.filter((d) => d.visible).length)}</p>
    </section>
  );
}
