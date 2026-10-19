"use client";

import { useState, useTransition } from "react";

import { deleteImport, dismissUnmatched, mapUnmatched, type ActionResult } from "@/app/(app)/admin/data-actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { AdminImport, AdminUnmatched } from "./types";

function useAction() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast(r.error);
      else if (r.message) toast(r.message);
    });
  return { pending, run };
}

const n = (v: unknown) => (typeof v === "number" ? v : 0);

export function ImportsList({ imports }: { imports: AdminImport[] }) {
  const { pending, run } = useAction();
  return (
    <section aria-labelledby="imports-title">
      <h2 id="imports-title" className="mb-2 text-[15px] font-bold text-fg">
        Lần tải lên gần đây
      </h2>
      {imports.length === 0 ? (
        <p className="text-[12.5px] text-muted">Chưa có lần nhập giá nào.</p>
      ) : (
        <div className="overflow-x-auto rounded-panel border border-line">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-[12.5px]">
            <thead>
              <tr className="text-[11.5px] text-muted">
                {["Ngày giá", "Tải lên lúc", "Nguồn", "Đại lý", "Giá", "Thay đổi", ""].map((h) => (
                  <th key={h} scope="col" className="border-b border-line bg-head px-3 py-2 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {imports.map((im, i) => {
                const s = im.summary;
                const td = cn("border-b border-line-2 px-3 py-2", i % 2 === 0 ? "bg-row-a" : "bg-row-b");
                return (
                  <tr key={im.id}>
                    <td className={cn(td, "num font-semibold text-fg")}>{im.day}</td>
                    <td className={cn(td, "num text-muted")}>{im.createdAt}</td>
                    <td className={td}>
                      <div className="text-fg">{im.source === "seed" ? "Dữ liệu khởi tạo" : "Quản trị"}</div>
                      {im.fileName && <div className="num max-w-[260px] truncate text-[11px] text-faint">{im.fileName}</div>}
                    </td>
                    <td className={cn(td, "num text-fg-2")}>{im.dealers}</td>
                    <td className={cn(td, "num text-fg-2")}>
                      {im.prices}
                      {im.unmatched > 0 && <span className="ml-1 text-warn">+{im.unmatched} chưa khớp</span>}
                    </td>
                    <td className={cn(td, "text-[12px] text-muted")}>
                      {im.source === "seed" ? "—" : `${n(s.price)} đổi giá · ${n(s.new)} mới · ${n(s.removed)} bỏ · ${n(s.stock)} đổi tình trạng`}
                    </td>
                    <td className={cn(td, "text-right")}>
                      {im.source === "admin" && (
                        <Button
                          size="sm"
                          disabled={pending}
                          onClick={() => {
                            if (confirm(`Huỷ lần tải lên ngày ${im.day} (${im.prices} giá)? Bảng giá sẽ quay về lần cập nhật trước đó.`)) run(() => deleteImport(im.id));
                          }}
                        >
                          Huỷ lần này
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function UnmatchedPanel({ rows, products }: { rows: AdminUnmatched[]; products: { id: number; model: string }[] }) {
  const { pending, run } = useAction();
  const [pick, setPick] = useState<Record<number, string>>({});
  return (
    <section aria-labelledby="unmatched-title">
      <h2 id="unmatched-title" className="mb-1 text-[15px] font-bold text-fg">
        Dòng giá chưa khớp mẫu <span className="num text-[13px] font-normal text-warn">{rows.length}</span>
      </h2>
      <p className="mb-2 max-w-[100ch] text-[12.5px] text-muted">
        Tin đăng của đại lý không khớp mẫu nào trong danh mục (mẫu cũ, mẫu ngoài 99 mẫu, hoặc tên viết khác). Chọn đúng mẫu rồi bấm Gắn: giá này hiện ngay
        trên bảng giá và các lần tải lên sau tự khớp. Mẫu không thuộc danh mục thì bấm Bỏ qua.
      </p>
      {rows.length === 0 ? (
        <p className="text-[12.5px] text-muted">Không còn dòng nào chưa khớp.</p>
      ) : (
        <div className="max-h-[60vh] overflow-auto rounded-panel border border-line">
          <table className="w-full min-w-[900px] border-separate border-spacing-0 text-[12.5px]">
            <thead>
              <tr className="text-[11.5px] text-muted">
                {["Tên trên web đại lý", "Đại lý", "Giá", "Ghi chú", "Gắn vào mẫu"].map((h) => (
                  <th key={h} scope="col" className="sticky top-0 border-b border-line bg-head px-3 py-2 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((u, i) => {
                const td = cn("border-b border-line-2 px-3 py-2 align-top", i % 2 === 0 ? "bg-row-a" : "bg-row-b");
                return (
                  <tr key={u.id}>
                    <td className={cn(td, "max-w-[340px] text-fg")}>
                      {u.url ? (
                        <a href={u.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {u.name}
                        </a>
                      ) : (
                        u.name
                      )}
                      <div className="num text-[10.5px] text-faint">ngày {u.day}</div>
                    </td>
                    <td className={cn(td, "text-fg-2")}>{u.dealer}</td>
                    <td className={cn(td, "num text-right text-fg")}>{u.price !== null ? fmtNum(u.price) : "Liên hệ"}</td>
                    <td className={cn(td, "max-w-[260px] text-[12px] text-muted")}>{u.note}</td>
                    <td className={td}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <select
                          aria-label={`Mẫu cho ${u.name}`}
                          value={pick[u.id] ?? ""}
                          onChange={(e) => setPick((p) => ({ ...p, [u.id]: e.target.value }))}
                          className="h-8 max-w-[200px] rounded-ctl border border-line bg-app px-2 text-[12.5px] text-fg"
                        >
                          <option value="">Chọn mẫu …</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.model}
                            </option>
                          ))}
                        </select>
                        <Button size="sm" variant="primary" disabled={pending || !pick[u.id]} onClick={() => run(() => mapUnmatched(u.id, Number(pick[u.id])))}>
                          Gắn
                        </Button>
                        <Button size="sm" disabled={pending} onClick={() => run(() => dismissUnmatched(u.id))}>
                          Bỏ qua
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export { useAction };
