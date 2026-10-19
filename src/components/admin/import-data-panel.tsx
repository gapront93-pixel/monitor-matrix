"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { useToast } from "@/components/ui/toast";
import { fmtNum } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import { adminMessages } from "@/lib/i18n/messages/admin";
import { convertRaw } from "@/lib/import-convert";
import { YEARS, type ImportData } from "@/lib/imports";

export type AdminImportInfo = {
  latest: string;
  counts: Record<number, number>;
  source: { fileName: string; uploadedAt: string; uploadedBy: string } | null;
  history: { name: string; savedAt: string }[];
};

type Preview = { fileName: string; sheet: string; data: ImportData; latest: string; counts: Record<number, number>; skipped: { otherYears: number; noQty: number } };

const when = (iso: string) => new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
// "2026-10-19T11-20-47" (history file stamp, UTC) -> local date and time
const stampToIso = (s: string) => s.replace(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2}).*$/, "$1T$2:$3:$4Z");

/** Cell values as plain data: formulas give their result, rich text its text */
function cellValue(c: unknown): unknown {
  if (c && typeof c === "object" && !(c instanceof Date)) {
    const o = c as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (o.result !== undefined) return o.result;
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.text !== undefined) return o.text;
    return null;
  }
  return c;
}

export function ImportDataPanel({ info: initial }: { info: AdminImportInfo }) {
  const t = useT(adminMessages).importData;
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [info, setInfo] = useState(initial);
  const [busy, setBusy] = useState<"reading" | "saving" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  const read = async (file: File) => {
    setBusy("reading");
    setError(null);
    setPreview(null);
    try {
      // Loaded only here: the workbook reader is large and only this panel needs it
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const headerOf = (ws: (typeof wb.worksheets)[number]) => (ws.getRow(1).values as unknown[]).slice(1).map((v) => String(cellValue(v) ?? ""));
      const fits = (ws: (typeof wb.worksheets)[number]) => {
        const h = headerOf(ws).map((x) => x.trim().toUpperCase());
        return ["MODEL", "BRAND", "QTY", "REV"].every((k) => h.includes(k));
      };
      // The RAW sheet (newest first if there are several), else any sheet with the RAW columns
      const raws = wb.worksheets.filter((ws) => /^raw/i.test(ws.name.trim()) && fits(ws)).sort((a, b) => b.name.localeCompare(a.name));
      const ws = raws[0] ?? wb.worksheets.find(fits);
      if (!ws) throw new Error(t.noSheet);
      const rows: unknown[][] = [];
      ws.eachRow({ includeEmpty: false }, (row) => rows.push((row.values as unknown[]).slice(1).map(cellValue)));
      // Brand spellings already in use, so a re-upload keeps them
      const current = await fetch("/api/nhap-khau?f=raw").then((r) => (r.ok ? (r.json() as Promise<ImportData>) : null)).catch(() => null);
      const res = convertRaw(rows, current?.dicts.brand ?? []);
      if (!res.ok) throw new Error(t.missing(res.missing.join(", ")));
      setPreview({ fileName: file.name, sheet: ws.name, data: res.data, latest: res.latest, counts: res.counts, skipped: res.skipped });
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t.badFile);
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  };

  const post = async (body: object, done: string) => {
    setBusy("saving");
    setError(null);
    try {
      const res = await fetch("/api/admin/import-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(t.failed(out.detail ?? out.error ?? String(res.status)));
      setInfo(out.info);
      setPreview(null);
      toast(done);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed("?"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel className="flex flex-col gap-3 p-4">
        <h2 className="text-[17px] text-fg">{t.title}</h2>
        <div className="flex flex-col gap-1 text-[13px]">
          <span className="text-muted">{t.current}</span>
          <span className="font-semibold text-fg">{t.upTo(info.latest)}</span>
          <span className="num text-fg-2">{YEARS.map((y) => t.rows(y, fmtNum(info.counts[y] ?? 0))).join(" · ")}</span>
          <span className="text-muted">{info.source ? t.uploaded(info.source.fileName, info.source.uploadedBy, when(info.source.uploadedAt)) : t.shipped}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
          <input ref={input} type="file" accept=".xlsx" className="hidden" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
          <Button variant="primary" size="sm" disabled={busy !== null} onClick={() => input.current?.click()}>
            {t.pick}
          </Button>
          {busy === "reading" && <span className="text-[13px] text-muted">{t.reading}</span>}
        </div>
        <p className="text-[12px] text-faint">{t.hint}</p>
        {error && <p className="rounded-ctl border border-err-line bg-err-bg px-3 py-2 text-[13px] text-err-title">{error}</p>}
      </Panel>

      {preview && (
        <Panel className="flex flex-col gap-3 p-4">
          <h2 className="text-[17px] text-fg">{t.preview}</h2>
          <div className="flex flex-col gap-1 text-[13px]">
            <span className="text-muted">
              {preview.fileName} · {t.sheet(preview.sheet)}
            </span>
            <span className="font-semibold text-fg">{t.newUpTo(preview.latest)}</span>
            <ul className="num flex flex-col gap-0.5 text-fg-2">
              {YEARS.map((y) => (
                <li key={y}>
                  {y}: {t.change(fmtNum(info.counts[y] ?? 0), fmtNum(preview.counts[y]))}
                </li>
              ))}
            </ul>
            <span className="text-muted">{t.brandsModels(fmtNum(preview.data.dicts.brand.length), fmtNum(preview.data.dicts.model.length))}</span>
            {preview.skipped.otherYears > 0 && <span className="text-faint">{t.skipped(fmtNum(preview.skipped.otherYears))}</span>}
            {preview.skipped.noQty > 0 && <span className="text-faint">{t.noQty(fmtNum(preview.skipped.noQty))}</span>}
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" disabled={busy !== null} onClick={() => post({ action: "upload", fileName: preview.fileName, data: preview.data }, t.applied)}>
              {busy === "saving" ? t.applying : t.apply}
            </Button>
            <Button size="sm" disabled={busy !== null} onClick={() => setPreview(null)}>
              {t.cancel}
            </Button>
          </div>
        </Panel>
      )}

      <Panel className="flex flex-col gap-2 p-4">
        <h2 className="text-[17px] text-fg">{t.history}</h2>
        <p className="text-[12px] text-faint">{t.historyNote}</p>
        {info.history.length === 0 ? (
          <p className="text-[13px] text-muted">{t.noHistory}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-2">
            {info.history.map((h) => (
              <li key={h.name} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                <span className="num text-fg-2">{t.saved(when(stampToIso(h.savedAt)))}</span>
                <Button
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => {
                    if (window.confirm(t.restoreConfirm)) post({ action: "restore", name: h.name }, t.restored);
                  }}
                >
                  {t.restore}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
