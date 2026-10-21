"use client";

import { LinkIcon, RefreshCwIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import { removeImage } from "@/app/(app)/admin/images/actions";
import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/lib/i18n/client";
import { adminMessages } from "@/lib/i18n/messages/admin";
import { normKey } from "@/lib/normalize";
import { cn } from "@/lib/utils";

type Item = {
  id: number;
  slug: string;
  model: string;
  brand: string;
  isGigabyte: boolean;
  thumb: string | null;
  source: string | null;
  kind: "none" | "auto" | "manual";
  sourceUrl: string | null;
  updated: string | null;
  dealerPages: number;
  makerUrl: string | null;
};

type FetchRow = { slug: string; model: string; ok: boolean; source?: string; error?: string };
type UploadRow = { file: string; ok: boolean; model?: string; error?: string };
type LinkRow = { line: number; ok: boolean; model?: string; error?: string };

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/gif";
const MAX_FILE = 7.5 * 1024 * 1024;
const MAX_GROUP = 6 * 1024 * 1024;

export function ImagesManager({ items }: { items: Item[] }) {
  const t = useT(adminMessages).images;
  const httpError = useT(adminMessages).upload.httpError;
  const router = useRouter();
  const toast = useToast();
  const [kind, setKind] = useState<"all" | Item["kind"]>("all");
  const [brand, setBrand] = useState<"gigabyte" | "rival" | "all">("gigabyte");
  const [q, setQ] = useState("");
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Automatic fetch run
  const [mode, setMode] = useState<"missing" | "refresh">("missing");
  const [withRivals, setWithRivals] = useState(false);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<FetchRow[]>([]);
  const [left, setLeft] = useState<number | null>(null);
  const stop = useRef(false);

  // Upload
  const input = useRef<HTMLInputElement>(null);
  const single = useRef<HTMLInputElement>(null);
  const singleFor = useRef<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploads, setUploads] = useState<UploadRow[]>([]);

  // Pasted links
  const [links, setLinks] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkRows, setLinkRows] = useState<LinkRow[]>([]);

  const shown = useMemo(() => {
    const k = normKey(q);
    return items.filter(
      (i) =>
        (kind === "all" || i.kind === kind) &&
        (brand === "all" || (brand === "gigabyte") === i.isGigabyte) &&
        (!k || normKey(`${i.brand} ${i.model} ${i.slug}`).includes(k)),
    );
  }, [items, kind, brand, q]);

  const post = async (url: string, body: BodyInit, json = true) => {
    const res = await fetch(url, { method: "POST", body, headers: json ? { "Content-Type": "application/json" } : undefined });
    const data = await res.json().catch(() => ({ error: httpError(res.status) }));
    if (!res.ok) throw new Error(data.error ?? httpError(res.status));
    return data;
  };

  const runAuto = async () => {
    setRunning(true);
    setLog([]);
    setLeft(null);
    stop.current = false;
    const skip: string[] = [];
    try {
      for (;;) {
        const req = JSON.stringify({ mode, scope: withRivals ? "all" : "gigabyte", skip });
        // One retry after a pause: the app may be restarting (deploy or memory limit), the run goes on from where it was
        const body = await post("/api/admin/images/auto", req).catch(() => new Promise((r) => setTimeout(r, 8000)).then(() => post("/api/admin/images/auto", req)));
        for (const r of body.results as FetchRow[]) skip.push(r.slug);
        setLog((l) => [...l, ...body.results]);
        setLeft(body.remaining);
        if (body.done || stop.current) break;
      }
      toast(stop.current ? t.stopped : t.finished);
    } catch (e) {
      toast(e instanceof Error ? e.message : t.fetchError);
    } finally {
      setRunning(false);
      router.refresh();
    }
  };

  const fetchOne = async (slug: string) => {
    setBusySlug(slug);
    try {
      const body = await post("/api/admin/images/auto", JSON.stringify({ slug, mode: "refresh" }));
      const r = body.results?.[0] as FetchRow | undefined;
      toast(r?.ok ? t.gotOne(r.model) : t.failedOne(r?.error ?? t.unknown));
    } catch (e) {
      toast(e instanceof Error ? e.message : t.fetchError);
    } finally {
      setBusySlug(null);
      router.refresh();
    }
  };

  const upload = async (files: FileList | File[], slug?: string) => {
    const list = [...files];
    if (!list.length) return;
    setUploading(true);
    if (slug) setBusySlug(slug);
    // Requests stay under the 8 MB proxy limit: oversized photos are refused here, the rest go in small groups
    const rows: UploadRow[] = list.filter((f) => f.size > MAX_FILE).map((f) => ({ file: f.name, ok: false, error: t.tooBig }));
    const groups: File[][] = [];
    for (const f of list.filter((x) => x.size <= MAX_FILE)) {
      const g = groups.at(-1);
      if (g && g.length < 10 && g.reduce((n, x) => n + x.size, 0) + f.size <= MAX_GROUP) g.push(f);
      else groups.push([f]);
    }
    try {
      for (const g of groups) {
        const form = new FormData();
        for (const f of g) form.append("files", f);
        if (slug) form.set("slug", slug);
        const body = await post("/api/admin/images/upload", form, false);
        rows.push(...(body.results as UploadRow[]));
        setUploads([...rows]);
      }
      setUploads(rows);
      toast(t.saved(rows.filter((r) => r.ok).length, rows.length));
    } catch (e) {
      toast(e instanceof Error ? e.message : t.uploadError);
    } finally {
      setUploading(false);
      setBusySlug(null);
      router.refresh();
    }
  };

  const sendLinks = async (payload: { text?: string; slug?: string; url?: string }) => {
    setLinking(true);
    if (payload.slug) setBusySlug(payload.slug);
    try {
      const body = await post("/api/admin/images/link", JSON.stringify(payload));
      const rows = body.results as LinkRow[];
      setLinkRows(rows);
      toast(t.linkDone(rows.filter((r) => r.ok).length, rows.length));
      if (!payload.slug && rows.every((r) => r.ok)) setLinks("");
    } catch (e) {
      toast(e instanceof Error ? e.message : t.uploadError);
    } finally {
      setLinking(false);
      setBusySlug(null);
      router.refresh();
    }
  };

  const remove = (it: Item) => {
    if (!confirm(t.deleteConfirm(it.model))) return;
    startTransition(async () => {
      const r = await removeImage(it.id);
      toast(r.ok ? (r.message ?? t.deleted) : r.error);
    });
  };

  const okCount = log.filter((l) => l.ok).length;
  const failed = log.filter((l) => !l.ok);
  const count = (k: "all" | Item["kind"]) => items.filter((i) => (k === "all" || i.kind === k) && (brand === "all" || (brand === "gigabyte") === i.isGigabyte)).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid items-start gap-3 xl:grid-cols-3">
        <Panel className="p-4">
          <h2 className="text-[18px] font-bold text-fg">{t.autoTitle}</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{t.autoHelp}</p>
          <div className="mt-3 flex flex-col gap-2 text-[12.5px] text-fg-2">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="radio" name="mode" checked={mode === "missing"} onChange={() => setMode("missing")} className="accent-accent" disabled={running} />
              {t.modeMissing}
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="radio" name="mode" checked={mode === "refresh"} onChange={() => setMode("refresh")} className="accent-accent" disabled={running} />
              {t.modeRefresh}
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={withRivals} onChange={(e) => setWithRivals(e.target.checked)} className="size-4 accent-accent" disabled={running} />
              {t.withRivals}
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {running ? (
              <Button onClick={() => (stop.current = true)}>{t.stop}</Button>
            ) : (
              <Button variant="primary" onClick={runAuto}>
                <RefreshCwIcon className="size-4" /> {t.start}
              </Button>
            )}
            {(running || log.length > 0) && (
              <span aria-live="polite" className="num text-[12px] text-muted">
                {t.progress(running, log.length)}
                <span className="text-best">{okCount}</span>
                {t.progressFail}
                <span className="text-warn">{failed.length}</span>
                {left !== null && t.left(left)}
              </span>
            )}
          </div>
          {failed.length > 0 && (
            <details className="mt-3 rounded-ctl border border-line bg-app">
              <summary className="cursor-pointer px-3 py-2 text-[12.5px] font-semibold text-fg-2">{t.failedTitle(failed.length)}</summary>
              <ul className="max-h-[220px] overflow-y-auto px-3 pb-2 text-[12px]">
                {failed.map((f) => (
                  <li key={f.slug} className="border-t border-line-2 py-1.5">
                    <b className="text-fg">{f.model}</b> <span className="text-muted">— {f.error}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Panel>

        <Panel className="p-4">
          <h2 className="text-[18px] font-bold text-fg">{t.uploadTitle}</h2>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              upload(e.dataTransfer.files);
            }}
            className={cn("mt-2 flex flex-col items-center rounded-box border border-dashed px-4 py-6 text-center", drag ? "border-accent bg-accent-tint" : "border-line-dashed")}
          >
            {uploading && !busySlug ? (
              <span className="text-[13px] text-fg-2">{t.processing}</span>
            ) : (
              <>
                <p className="text-[13px] font-semibold text-fg">{t.drop}</p>
                <p className="mt-1 max-w-[60ch] text-[12px] text-muted">{t.dropHelp}</p>
                <Button variant="primary" size="sm" className="mt-3" onClick={() => input.current?.click()}>
                  <UploadIcon className="size-4" /> {t.choose}
                </Button>
              </>
            )}
            <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} />
            <input
              ref={single}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                if (e.target.files && singleFor.current) upload(e.target.files, singleFor.current);
                e.target.value = "";
              }}
            />
          </div>
          {uploads.length > 0 && (
            <ul className="mt-2 max-h-[180px] overflow-y-auto text-[12px]">
              {uploads.map((u, i) => (
                <li key={i} className="flex gap-2 border-t border-line-2 py-1.5">
                  <span className="num min-w-0 flex-1 truncate text-fg-2">{u.file}</span>
                  {u.ok ? <span className="text-best">→ {u.model}</span> : <span className="text-warn">{u.error}</span>}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="p-4">
          <h2 className="text-[18px] font-bold text-fg">{t.linkTitle}</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{t.linkHelp}</p>
          <textarea
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            rows={5}
            spellCheck={false}
            placeholder={t.linkPlaceholder}
            aria-label={t.linkTitle}
            className="num mt-2 w-full rounded-ctl border border-line bg-app px-2.5 py-2 text-[11.5px] text-fg placeholder:text-faint"
          />
          <Button variant="primary" size="sm" className="mt-2" disabled={linking || !links.trim()} onClick={() => sendLinks({ text: links })}>
            <LinkIcon className="size-4" /> {linking ? t.linkWorking : t.linkSubmit}
          </Button>
          {linkRows.length > 0 && (
            <ul className="mt-2 max-h-[160px] overflow-y-auto text-[12px]">
              {linkRows.map((r) => (
                <li key={r.line} className="flex gap-2 border-t border-line-2 py-1.5">
                  <span className="num w-14 shrink-0 text-faint">{t.lineN(r.line)}</span>
                  {r.ok ? <span className="text-best">→ {r.model}</span> : <span className="text-warn">{r.error}</span>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {(["all", "none", "auto", "manual"] as const).map((k) => (
            <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
              {t.kinds[k]}
              <span className="num ml-1.5 text-[11px] opacity-70">{count(k)}</span>
            </Chip>
          ))}
          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
          {(["gigabyte", "rival", "all"] as const).map((k) => (
            <Chip key={k} active={brand === k} onClick={() => setBrand(k)}>
              {t.brands[k]}
            </Chip>
          ))}
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.search}
            aria-label={t.search}
            className="ml-auto h-8 w-full rounded-ctl border border-line bg-app px-2.5 text-[13px] text-fg placeholder:text-faint md:w-[220px]"
          />
        </div>

        {shown.length === 0 ? (
          <EmptyState title={t.none} />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {shown.map((it) => (
              <article key={it.id} className={cn("flex flex-col rounded-panel border bg-panel p-2.5", it.kind === "none" ? "border-line-dashed" : "border-line")}>
                <ProductImage src={it.thumb} label={it.model} className="aspect-[4/3] w-full" />
                <div className="mt-2 min-w-0">
                  <div className={cn("text-[10.5px] font-bold tracking-[0.06em] uppercase", it.isGigabyte ? "text-brand-gb" : "text-muted")}>{it.brand}</div>
                  <div className="truncate text-[13px] font-bold text-fg" title={it.model}>
                    {it.model}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-muted">
                    {it.source ? (
                      it.sourceUrl ? (
                        <a href={it.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-key hover:underline">
                          {it.source} ↗
                        </a>
                      ) : (
                        it.source
                      )
                    ) : (
                      <span className="text-warn">{t.missing}</span>
                    )}
                    {it.updated && <span className="num text-faint"> · {it.updated}</span>}
                  </div>
                  {it.kind === "none" && (
                    <div className="mt-0.5 text-[10.5px] text-faint">{it.dealerPages ? t.pages(it.dealerPages) : it.isGigabyte ? t.noDealer : t.tryMaker}</div>
                  )}
                </div>
                <div className="mt-auto flex gap-1.5 pt-2">
                  <Button
                    size="sm"
                    className="flex-1 px-2"
                    disabled={busySlug === it.slug || uploading}
                    onClick={() => {
                      singleFor.current = it.slug;
                      single.current?.click();
                    }}
                    title={t.uploadFor}
                  >
                    <UploadIcon className="size-3.5" /> {it.kind === "none" ? t.uploadShort : t.change}
                  </Button>
                  <Button
                    size="sm"
                    className="px-2"
                    disabled={busySlug === it.slug || linking}
                    title={t.pasteLink}
                    aria-label={t.pasteLink}
                    onClick={() => {
                      const url = prompt(t.linkAsk(it.model))?.trim();
                      if (url) sendLinks({ slug: it.slug, url });
                    }}
                  >
                    <LinkIcon className="size-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    className="px-2"
                    disabled={busySlug === it.slug || running || (!it.dealerPages && !(!it.isGigabyte && it.makerUrl))}
                    onClick={() => fetchOne(it.slug)}
                    title={t.autoOne}
                    aria-label={t.autoOne}
                  >
                    <RefreshCwIcon className={cn("size-3.5", busySlug === it.slug && "animate-spin")} />
                  </Button>
                  {it.kind !== "none" && (
                    <Button size="sm" className="px-2" onClick={() => remove(it)} title={t.deleteImage} aria-label={t.deleteOf(it.model)}>
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
