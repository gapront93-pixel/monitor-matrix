"use client";

import { RefreshCwIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import { removeImage } from "@/app/(app)/admin/anh/actions";
import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
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
  kind: "none" | "auto" | "upload";
  sourceUrl: string | null;
  updated: string | null;
  dealerPages: number;
  makerUrl: string | null;
};

type FetchRow = { slug: string; model: string; ok: boolean; source?: string; error?: string };
type UploadRow = { file: string; ok: boolean; model?: string; error?: string };

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/gif";
const MAX_FILE = 7.5 * 1024 * 1024;
const MAX_GROUP = 6 * 1024 * 1024;

export function ImagesManager({ items }: { items: Item[] }) {
  const router = useRouter();
  const toast = useToast();
  const [kind, setKind] = useState<"all" | Item["kind"]>("all");
  const [brand, setBrand] = useState<"gigabyte" | "rival" | "all">("gigabyte");
  const [q, setQ] = useState("");
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Auto fetch run
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

  const shown = useMemo(() => {
    const k = normKey(q);
    return items.filter(
      (i) =>
        (kind === "all" || i.kind === kind) &&
        (brand === "all" || (brand === "gigabyte") === i.isGigabyte) &&
        (!k || normKey(`${i.brand} ${i.model} ${i.slug}`).includes(k)),
    );
  }, [items, kind, brand, q]);

  const runAuto = async () => {
    setRunning(true);
    setLog([]);
    setLeft(null);
    stop.current = false;
    const skip: string[] = [];
    try {
      for (;;) {
        const res = await fetch("/api/admin/anh/tu-dong", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, scope: withRivals ? "all" : "gigabyte", skip }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Lỗi ${res.status}`);
        for (const r of body.results as FetchRow[]) skip.push(r.slug);
        setLog((l) => [...l, ...body.results]);
        setLeft(body.remaining);
        if (body.done || stop.current) break;
      }
      toast(stop.current ? "Đã dừng lấy ảnh" : "Đã lấy ảnh xong");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Lỗi khi lấy ảnh");
    } finally {
      setRunning(false);
      router.refresh();
    }
  };

  const fetchOne = async (slug: string) => {
    setBusySlug(slug);
    try {
      const res = await fetch("/api/admin/anh/tu-dong", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, mode: "refresh" }) });
      const body = await res.json();
      const r = body.results?.[0] as FetchRow | undefined;
      toast(!res.ok ? (body.error ?? "Lỗi") : r?.ok ? `Đã lấy ảnh ${r.model}` : `Chưa lấy được: ${r?.error ?? "không rõ"}`);
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
    const rows: UploadRow[] = list.filter((f) => f.size > MAX_FILE).map((f) => ({ file: f.name, ok: false, error: "Ảnh lớn hơn 7.5 MB, hãy giảm kích thước rồi tải lại" }));
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
        const res = await fetch("/api/admin/anh/tai-len", { method: "POST", body: form });
        const body = await res.json().catch(() => ({ error: `Lỗi ${res.status}` }));
        if (!res.ok) throw new Error(body.error ?? `Lỗi ${res.status}`);
        rows.push(...(body.results as UploadRow[]));
        setUploads([...rows]);
      }
      setUploads(rows);
      const ok = rows.filter((r) => r.ok).length;
      toast(`Đã lưu ${ok}/${rows.length} ảnh`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Lỗi khi tải ảnh");
    } finally {
      setUploading(false);
      setBusySlug(null);
      router.refresh();
    }
  };

  const remove = (it: Item) => {
    if (!confirm(`Xoá ảnh của ${it.model}?`)) return;
    startTransition(async () => {
      const r = await removeImage(it.id);
      toast(r.ok ? (r.message ?? "Đã xoá") : r.error);
    });
  };

  const okCount = log.filter((l) => l.ok).length;
  const failed = log.filter((l) => !l.ok);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid items-start gap-3 xl:grid-cols-2">
        <Panel className="p-4">
          <h2 className="text-[15px] font-bold text-fg">Lấy ảnh tự động</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            Lấy ảnh đại diện từ trang sản phẩm của đại lý (ưu tiên Thế Giới Di Động, Điện Máy Xanh, FPTShop, GEARVN, HaCom…). Chỉ nhận ảnh khi tiêu đề trang
            có đúng mã mẫu. gigabyte.com chặn truy cập từ máy chủ, nên mẫu chưa có đại lý bán cần tải ảnh lên tay. Ảnh bạn tự tải lên không bao giờ bị thay.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-fg-2">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="radio" name="mode" checked={mode === "missing"} onChange={() => setMode("missing")} className="accent-accent" disabled={running} />
              Chỉ mẫu chưa có ảnh
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="radio" name="mode" checked={mode === "refresh"} onChange={() => setMode("refresh")} className="accent-accent" disabled={running} />
              Lấy lại cả ảnh tự động cũ
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={withRivals} onChange={(e) => setWithRivals(e.target.checked)} className="size-4 accent-accent" disabled={running} />
              Thử cả mẫu đối thủ (từ trang hãng)
            </label>
          </div>
          <div className="mt-3 flex items-center gap-2">
            {running ? (
              <Button onClick={() => (stop.current = true)}>Dừng sau đợt này</Button>
            ) : (
              <Button variant="primary" onClick={runAuto}>
                <RefreshCwIcon className="size-4" /> Bắt đầu lấy ảnh
              </Button>
            )}
            {(running || log.length > 0) && (
              <span aria-live="polite" className="num text-[12px] text-muted">
                {running && "Đang xử lý … "}đã thử {log.length} · lấy được <span className="text-best">{okCount}</span> · chưa được{" "}
                <span className="text-warn">{failed.length}</span>
                {left !== null && ` · còn ${left}`}
              </span>
            )}
          </div>
          {failed.length > 0 && (
            <details className="mt-3 rounded-ctl border border-line bg-app">
              <summary className="cursor-pointer px-3 py-2 text-[12.5px] font-semibold text-fg-2">Mẫu chưa lấy được ảnh ({failed.length})</summary>
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
          <h2 className="text-[15px] font-bold text-fg">Tải ảnh lên</h2>
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
              <span className="text-[13px] text-fg-2">Đang xử lý ảnh …</span>
            ) : (
              <>
                <p className="text-[13px] font-semibold text-fg">Kéo thả nhiều ảnh vào đây</p>
                <p className="mt-1 max-w-[60ch] text-[12px] text-muted">
                  Đặt <b className="text-fg-2">tên file theo mã mẫu</b>: <code className="num">MO27Q28G.jpg</code>, <code className="num">AORUS-FO32U2P.png</code>,{" "}
                  <code className="num">G34WQCP-rev-20.webp</code>. App tự gắn đúng mẫu, tự thu nhỏ và nén ảnh. JPG, PNG, WebP; ảnh nền trắng đẹp nhất.
                </p>
                <Button variant="primary" size="sm" className="mt-3" onClick={() => input.current?.click()}>
                  <UploadIcon className="size-4" /> Chọn ảnh
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
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {(
            [
              ["all", "Tất cả"],
              ["none", "Chưa có ảnh"],
              ["auto", "Tự động"],
              ["upload", "Tải lên"],
            ] as const
          ).map(([k, label]) => (
            <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
              {label}
              <span className="num ml-1.5 text-[11px] opacity-70">{items.filter((i) => (k === "all" || i.kind === k) && (brand === "all" || (brand === "gigabyte") === i.isGigabyte)).length}</span>
            </Chip>
          ))}
          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
          {(
            [
              ["gigabyte", "GIGABYTE"],
              ["rival", "Đối thủ"],
              ["all", "Cả hai"],
            ] as const
          ).map(([k, label]) => (
            <Chip key={k} active={brand === k} onClick={() => setBrand(k)}>
              {label}
            </Chip>
          ))}
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm mẫu"
            aria-label="Tìm mẫu"
            className="ml-auto h-8 w-full rounded-ctl border border-line bg-app px-2.5 text-[13px] text-fg placeholder:text-faint md:w-[220px]"
          />
        </div>

        {shown.length === 0 ? (
          <EmptyState title="Không có mẫu nào khớp bộ lọc" />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
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
                      <span className="text-warn">Chưa có ảnh</span>
                    )}
                    {it.updated && <span className="num text-faint"> · {it.updated}</span>}
                  </div>
                  {it.kind === "none" && (
                    <div className="mt-0.5 text-[10.5px] text-faint">
                      {it.dealerPages ? `${it.dealerPages} trang đại lý để thử` : it.isGigabyte ? "Chưa có đại lý bán: tải ảnh lên tay" : "Thử từ trang hãng"}
                    </div>
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
                    title="Tải ảnh lên cho mẫu này"
                  >
                    <UploadIcon className="size-3.5" /> {it.kind === "none" ? "Tải lên" : "Đổi"}
                  </Button>
                  <Button size="sm" className="px-2" disabled={busySlug === it.slug || running || (!it.dealerPages && !(!it.isGigabyte && it.makerUrl))} onClick={() => fetchOne(it.slug)} title="Lấy ảnh tự động">
                    <RefreshCwIcon className={cn("size-3.5", busySlug === it.slug && "animate-spin")} />
                  </Button>
                  {it.kind !== "none" && (
                    <Button size="sm" className="px-2" onClick={() => remove(it)} title="Xoá ảnh" aria-label={`Xoá ảnh ${it.model}`}>
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
