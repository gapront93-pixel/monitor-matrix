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
import { cn } from "@/lib/utils";

import type { AdminDealer } from "./types";

type Filter = "all" | PreviewItem["kind"];

const FILTERS: { id: Filter; label: string; tone: string }[] = [
  { id: "all", label: "Tất cả", tone: "text-fg-2" },
  { id: "up", label: "Tăng giá", tone: "text-up" },
  { id: "down", label: "Giảm giá", tone: "text-best" },
  { id: "new", label: "Mới", tone: "text-key" },
  { id: "stock", label: "Đổi tình trạng", tone: "text-fg-2" },
  { id: "removed", label: "Bỏ niêm yết", tone: "text-fg-2" },
  { id: "error", label: "Lỗi", tone: "text-warn" },
];

const FORMAT: Record<UploadPreview["format"], string> = {
  "dealer-json": "JSON theo đại lý (như data/prices)",
  "bang-gia-csv": "CSV bảng giá (mỗi đại lý một cột)",
  "long-csv": "CSV theo dòng (model, dealer, price, status)",
};

const isoToVn = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

export function UploadPanel({ dealers }: { dealers: AdminDealer[] }) {
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
    const body = await res.json().catch(() => ({ error: "Máy chủ trả về dữ liệu không đọc được." }));
    if (!res.ok) throw new Error(body.error ?? `Lỗi ${res.status}`);
    return body;
  };

  const read = async (f: File, opts = { day, keepMissing }) => {
    setFile(f);
    setError(null);
    setPreview(null);
    setFilter("all");
    setLimit(200);
    if (!/\.(csv|json)$/i.test(f.name)) return setError("Chỉ nhận file .csv hoặc .json.");
    setBusy("reading");
    try {
      setPreview(await send("/api/admin/uploads", f, opts));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đọc được file.");
    } finally {
      setBusy(null);
    }
  };

  const apply = async () => {
    if (!file || !preview) return;
    setBusy("applying");
    try {
      const r = await send("/api/admin/uploads/apply", file, { day, keepMissing });
      toast(`Đã áp dụng ${r.applied} giá cho ngày ${isoToVn(r.day)} (lần nhập #${r.importId})`);
      reset();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được.");
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
      <h2 id="upload-title" className="mb-2 text-[15px] font-bold text-fg">
        Tải file giá
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
              Đang đọc {file?.name} …
            </div>
          ) : (
            <>
              <div className="text-[14px] font-bold text-fg">Kéo thả file .csv hoặc .json vào đây</div>
              <p className="mt-1 max-w-[70ch] text-[12.5px] leading-relaxed text-muted">
                Nhận 3 định dạng: file JSON của từng đại lý (giống <code className="num">data/prices</code>), CSV bảng giá mỗi đại lý một cột (giống{" "}
                <code className="num">bang-gia.csv</code>), hoặc CSV theo dòng với các cột bắt buộc <code className="num">model, dealer, price, status</code>{" "}
                (status: <code className="num">ok | oos | contact</code>). Chưa có gì được lưu cho tới khi bạn bấm Áp dụng.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button variant="primary" onClick={() => input.current?.click()}>
                  Chọn file
                </Button>
                <a className="h-8 content-center rounded-ctl border border-line px-3 text-[12.5px] font-semibold text-fg hover:border-line-hover" href="/api/admin/mau?loai=csv-doc">
                  File mẫu CSV theo dòng
                </a>
                <a className="h-8 content-center rounded-ctl border border-line px-3 text-[12.5px] font-semibold text-fg hover:border-line-hover" href="/api/admin/mau?loai=bang-gia">
                  Bảng giá hiện tại (.csv)
                </a>
                <a className="h-8 content-center rounded-ctl border border-line px-3 text-[12.5px] font-semibold text-fg hover:border-line-hover" href="/api/admin/mau?loai=json">
                  File mẫu JSON
                </a>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12.5px] text-fg-2">
                <label className="flex items-center gap-2">
                  Ngày giá
                  <input
                    type="date"
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
                    className="num h-8 rounded-ctl border border-line bg-app px-2 text-[12px] text-fg [color-scheme:dark]"
                  />
                  <span className="text-[11.5px] text-faint">(để trống: lấy ngày trong file, không có thì hôm nay)</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={keepMissing} onChange={(e) => setKeepMissing(e.target.checked)} className="size-4 accent-sel" />
                  Giữ giá cũ của các mẫu không có trong file
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
            title="Không dùng được file này"
            action={
              <Button size="sm" onClick={reset}>
                Chọn file khác
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
                {(preview.size / 1024).toFixed(1)} KB · {FORMAT[preview.format]} · {preview.rows} dòng giá · ngày giá {isoToVn(preview.day)}
                {preview.dayFromFile && " (lấy từ file)"} · {changed} dòng thay đổi
                {preview.previousDay ? ` so với lần cập nhật ${isoToVn(preview.previousDay)}` : " (chưa có lần cập nhật trước)"}
              </div>
              <div className="mt-1 text-[12px] text-fg-2">
                Đại lý trong file:{" "}
                {preview.dealers.map((d, i) => (
                  <span key={d.id}>
                    {i > 0 && ", "}
                    {d.name}
                    {d.isNew && <span className="text-key"> (mới, sẽ được thêm)</span>}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={reset} disabled={busy === "applying"}>
                Huỷ
              </Button>
              <Button variant="primary" onClick={apply} disabled={busy === "applying" || preview.applicable === 0}>
                {busy === "applying" ? "Đang lưu …" : `Áp dụng (${preview.applicable})`}
              </Button>
            </div>
          </Panel>

          {preview.counts.removed > 0 && !preview.keepMissing && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-panel border border-warn-line bg-warn-bg px-3.5 py-2.5 text-[12.5px] text-warn">
              <span>
                {preview.counts.removed} giá đang có sẽ bị bỏ vì không có trong file (file được coi là toàn bộ bảng giá của các đại lý trong file).
              </span>
              <button
                type="button"
                onClick={() => {
                  setKeepMissing(true);
                  if (file) read(file, { day, keepMissing: true });
                }}
                className="h-7 rounded-ctl border border-warn-line px-2.5 font-semibold text-fg hover:border-warn"
              >
                File chỉ có một phần giá: giữ giá cũ
              </button>
            </div>
          )}

          <div className="mb-3 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const n = f.id === "all" ? preview.items.length : preview.counts[f.id];
              if (f.id !== "all" && !n) return null;
              return (
                <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
                  {f.label}
                  <span className={cn("num ml-1.5 text-[11px]", filter === f.id ? "text-app" : f.tone)}>{n}</span>
                </Chip>
              );
            })}
            {preview.counts.same > 0 && <span className="self-center text-[12px] text-faint">· {preview.counts.same} giá không đổi</span>}
          </div>

          {items.length === 0 ? (
            <p className="rounded-panel border border-line px-4 py-6 text-center text-[12.5px] text-muted">
              Không có thay đổi nào so với giá hiện tại. Áp dụng vẫn sẽ ghi nhận ngày cập nhật mới.
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-auto rounded-panel border border-line">
              <table className="w-full min-w-[820px] border-separate border-spacing-0 text-[12.5px]">
                <thead>
                  <tr className="text-[11.5px] text-muted">
                    {["Mẫu", "Đại lý", "Giá cũ", "Giá mới", "Chênh lệch", "%", "Ghi chú"].map((h, i) => (
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
                        <td className={cn(td, "num text-right text-fg")}>{it.after !== null ? fmtNum(it.after) : it.kind === "removed" ? "—" : it.kind === "error" ? "" : "Liên hệ"}</td>
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
                    Hiện thêm ({items.length - limit} dòng)
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
      <p className="mt-2 text-[11.5px] text-faint">Đang theo dõi {dealers.filter((d) => d.visible).length} đại lý. Tên đại lý trong file khớp theo tên hoặc mã ở mục Đại lý.</p>
    </section>
  );
}
