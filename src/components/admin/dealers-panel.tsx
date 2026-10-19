"use client";

import { useState } from "react";

import { addDealer, deleteDealer, moveDealer, updateDealer } from "@/app/(app)/admin/data-actions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { useAction } from "./history-panels";
import type { AdminDealer } from "./types";

const STATUS: Record<string, string> = {
  ok: "",
  unreachable: "web chặn đọc tự động",
  no_website: "không có website",
  no_gigabyte_monitors: "không bán màn GIGABYTE",
};

const inputCls = "h-8 w-full rounded-ctl border border-line bg-app px-2 text-[12.5px] text-fg";

/** Edits save as soon as a field loses focus or a toggle changes; the order here is the column order of the price grid */
export function DealersPanel({ dealers, canDelete }: { dealers: AdminDealer[]; canDelete: boolean }) {
  const { pending, run } = useAction();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", website: "" });
  const shown = dealers.filter((d) => d.visible).length;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-muted">
          {dealers.length} đại lý · {shown} hiện trên Bảng giá · {dealers.filter((d) => d.isKey).length} trọng điểm · thứ tự ở đây là thứ tự cột trong Bảng
          giá. Thay đổi được lưu ngay.
        </p>
        <Button variant="primary" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
          Thêm đại lý
        </Button>
      </div>

      {adding && (
        <form
          className="mb-3 flex flex-wrap items-end gap-2 rounded-panel border border-line bg-panel p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const r = await addDealer(draft);
              if (r.ok) {
                setDraft({ name: "", website: "" });
                setAdding(false);
              }
              return r;
            });
          }}
        >
          <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-[12px] text-fg-2">
            Tên đại lý
            <input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
          </label>
          <label className="flex min-w-[240px] flex-[2] flex-col gap-1 text-[12px] text-fg-2">
            Website
            <input className={cn(inputCls, "num")} placeholder="https://" value={draft.website} onChange={(e) => setDraft({ ...draft, website: e.target.value })} />
          </label>
          <Button type="submit" variant="primary" size="sm" disabled={pending || !draft.name.trim()}>
            Lưu
          </Button>
          <Button size="sm" onClick={() => setAdding(false)}>
            Huỷ
          </Button>
        </form>
      )}

      <div className="overflow-x-auto rounded-panel border border-line">
        <table className="w-full min-w-[980px] border-separate border-spacing-0 text-[12.5px]">
          <thead>
            <tr className="text-[11.5px] text-muted">
              {["Cột", "Tên", "Website", "Trọng điểm", "Loại giá", "Hiện cột", "Thứ tự", ""].map((h) => (
                <th key={h} scope="col" className="border-b border-line bg-head px-2.5 py-2 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dealers.map((d, i) => {
              const td = cn("border-b border-line-2 px-2.5 py-1.5", i % 2 === 0 ? "bg-row-a" : "bg-row-b");
              return (
                <tr key={d.id} className={cn(!d.visible && "opacity-60")}>
                  <td className={cn(td, "num w-[52px] text-right text-muted")}>{i + 1}</td>
                  <td className={cn(td, "w-[220px]")}>
                    <input
                      key={d.name}
                      defaultValue={d.name}
                      aria-label={`Tên ${d.name}`}
                      className={cn(inputCls, "font-semibold", d.isKey && "text-key")}
                      onBlur={(e) => e.target.value.trim() !== d.name && run(() => updateDealer(d.id, { name: e.target.value }))}
                    />
                    <div className="num mt-0.5 text-[10.5px] text-faint">
                      mã: {d.id}
                      {STATUS[d.status] && ` · ${STATUS[d.status]}`}
                    </div>
                  </td>
                  <td className={td}>
                    <input
                      key={d.website}
                      defaultValue={d.website}
                      aria-label={`Website ${d.name}`}
                      placeholder="https://"
                      className={cn(inputCls, "num text-[12px]")}
                      onBlur={(e) => e.target.value.trim() !== d.website && run(() => updateDealer(d.id, { website: e.target.value }))}
                    />
                  </td>
                  <td className={td}>
                    <Switch checked={d.isKey} onCheckedChange={(v) => run(() => updateDealer(d.id, { isKey: v }))} />
                  </td>
                  <td className={td}>
                    <div className="inline-flex overflow-hidden rounded-ctl border border-line" role="group" aria-label={`Loại giá ${d.name}`}>
                      {(["retail", "dealer"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          aria-pressed={d.priceType === t}
                          disabled={pending}
                          onClick={() => d.priceType !== t && run(() => updateDealer(d.id, { priceType: t }))}
                          className={cn("h-7 px-2.5 text-[12px] font-semibold", t === "dealer" && "italic", d.priceType === t ? "bg-fg text-app" : "bg-app text-fg-2 hover:text-fg")}
                        >
                          {t === "retail" ? "Lẻ" : "Sỉ"}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className={td}>
                    <Switch checked={d.visible} onCheckedChange={(v) => run(() => updateDealer(d.id, { visible: v }))} />
                  </td>
                  <td className={cn(td, "whitespace-nowrap")}>
                    <Button size="icon" aria-label={`Đưa ${d.name} lên`} disabled={pending || i === 0} onClick={() => run(() => moveDealer(d.id, -1))}>
                      ▲
                    </Button>{" "}
                    <Button size="icon" aria-label={`Đưa ${d.name} xuống`} disabled={pending || i === dealers.length - 1} onClick={() => run(() => moveDealer(d.id, 1))}>
                      ▼
                    </Button>
                  </td>
                  <td className={cn(td, "text-right")}>
                    {canDelete && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => confirm(`Xoá đại lý ${d.name}?`) && run(() => deleteDealer(d.id))}
                      className="text-[12px] text-faint hover:text-up"
                      title={d.prices ? `Có ${d.prices} giá trong lịch sử: chỉ ẩn được, không xoá` : undefined}
                    >
                      Xoá
                    </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
