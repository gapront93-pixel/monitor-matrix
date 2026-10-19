"use client";

import { useState } from "react";

import { createUser, deleteUser, resetPassword, updateUser } from "@/app/(app)/admin/user-actions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MIN_PASSWORD, passwordProblem } from "@/lib/password-rules";
import { ROLES, type Role } from "@/lib/permissions";
import { cn } from "@/lib/utils";

import { useAction } from "./history-panels";
import type { AdminUser } from "./types";

const inputCls = "h-8 w-full rounded-ctl border border-line bg-app px-2 text-[12.5px] text-fg placeholder:text-faint";

function RolePicker({ value, onChange, disabled, label }: { value: Role; onChange: (r: Role) => void; disabled?: boolean; label: string }) {
  return (
    <div className="inline-flex overflow-hidden rounded-ctl border border-line" role="group" aria-label={label}>
      {ROLES.map((r) => (
        <button
          key={r.id}
          type="button"
          title={r.hint}
          aria-pressed={value === r.id}
          disabled={disabled}
          onClick={() => value !== r.id && onChange(r.id)}
          className={cn("h-7 px-2.5 text-[12px] font-semibold disabled:opacity-50", value === r.id ? "bg-fg text-app" : "bg-app text-fg-2 hover:text-fg")}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

export function UsersPanel({ users, meId }: { users: AdminUser[]; meId: number }) {
  const { pending, run } = useAction();
  const [adding, setAdding] = useState(users.length <= 1);
  const [draft, setDraft] = useState({ name: "", email: "", role: "viewer" as Role, password: "" });
  const [resetFor, setResetFor] = useState<number | null>(null);
  const [newPw, setNewPw] = useState("");
  const draftProblem = draft.password ? passwordProblem(draft.password) : null;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="text-[12.5px] text-muted">
          <p>
            {users.filter((u) => u.active).length} tài khoản đang hoạt động · {users.filter((u) => u.role === "admin" && u.active).length} Admin
          </p>
          <ul className="mt-1 list-inside list-disc text-[12px]">
            {ROLES.map((r) => (
              <li key={r.id}>
                <b className="text-fg-2">{r.label}</b>: {r.hint}
              </li>
            ))}
          </ul>
        </div>
        <Button variant="primary" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
          Thêm người dùng
        </Button>
      </div>

      {adding && (
        <form
          noValidate
          className="mb-3 grid gap-2 rounded-panel border border-line bg-panel p-3 md:grid-cols-[1fr_1.3fr_auto_1fr_auto] md:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const r = await createUser(draft);
              if (r.ok) setDraft({ name: "", email: "", role: "viewer", password: "" });
              return r;
            });
          }}
        >
          <label className="flex flex-col gap-1 text-[12px] text-fg-2">
            Họ tên
            <input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-fg-2">
            Email đăng nhập
            <input className={inputCls} type="email" placeholder="ten@gigabyte.vn" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
          </label>
          <div className="flex flex-col gap-1 text-[12px] text-fg-2">
            Vai trò
            <RolePicker label="Vai trò người dùng mới" value={draft.role} onChange={(role) => setDraft({ ...draft, role })} />
          </div>
          <label className="flex flex-col gap-1 text-[12px] text-fg-2">
            Mật khẩu
            <input
              className={cn(inputCls, "num")}
              type="text"
              autoComplete="off"
              placeholder={`ít nhất ${MIN_PASSWORD} ký tự, có chữ và số`}
              value={draft.password}
              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
            />
          </label>
          <Button type="submit" variant="primary" size="sm" disabled={pending || !draft.name.trim() || !draft.email.trim() || !draft.password || !!draftProblem}>
            Tạo tài khoản
          </Button>
          {draftProblem && <p className="text-[11.5px] text-warn md:col-span-5">{draftProblem}</p>}
          <p className="text-[11.5px] text-faint md:col-span-5">
            Gửi email và mật khẩu này cho người dùng qua kênh riêng (Zalo, gặp trực tiếp). Họ có thể tự đổi mật khẩu ở trang Tài khoản.
          </p>
        </form>
      )}

      <div className="overflow-x-auto rounded-panel border border-line">
        <table className="w-full min-w-[920px] border-separate border-spacing-0 text-[12.5px]">
          <thead>
            <tr className="text-[11.5px] text-muted">
              {["Người dùng", "Vai trò", "Hoạt động", "Đăng nhập gần nhất", "Tải giá", ""].map((h) => (
                <th key={h} scope="col" className="border-b border-line bg-head px-3 py-2 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => {
              const me = u.id === meId;
              const td = cn("border-b border-line-2 px-3 py-2 align-top", i % 2 === 0 ? "bg-row-a" : "bg-row-b");
              return (
                <tr key={u.id} className={cn(!u.active && "opacity-60")}>
                  <td className={cn(td, "w-[300px]")}>
                    <input
                      key={u.name}
                      defaultValue={u.name}
                      aria-label={`Tên ${u.email}`}
                      className={cn(inputCls, "font-semibold")}
                      onBlur={(e) => e.target.value.trim() !== u.name && run(() => updateUser(u.id, { name: e.target.value }))}
                    />
                    <div className="mt-0.5 text-[11.5px] text-muted">
                      {u.email}
                      {me && <span className="ml-1.5 text-key">(bạn)</span>}
                    </div>
                    <div className="num text-[10.5px] text-faint">tạo {u.created}</div>
                  </td>
                  <td className={td}>
                    <RolePicker label={`Vai trò ${u.email}`} value={u.role} disabled={pending || me} onChange={(role) => run(() => updateUser(u.id, { role }))} />
                  </td>
                  <td className={td}>
                    <Switch
                      checked={u.active}
                      onCheckedChange={(v) => {
                        if (me) return;
                        if (!v && !confirm(`Khoá ${u.email}? Người này bị đăng xuất ngay và không đăng nhập được nữa.`)) return;
                        run(() => updateUser(u.id, { active: v }));
                      }}
                    />
                  </td>
                  <td className={cn(td, "num text-[12px] text-muted")}>{u.lastLogin ?? "chưa đăng nhập"}</td>
                  <td className={cn(td, "num text-muted")}>{u.uploads || "—"}</td>
                  <td className={cn(td, "text-right whitespace-nowrap")}>
                    {resetFor === u.id ? (
                      <form
                        noValidate
                        className="flex items-center justify-end gap-1.5"
                        onSubmit={(e) => {
                          e.preventDefault();
                          run(async () => {
                            const r = await resetPassword(u.id, newPw);
                            if (r.ok) {
                              setResetFor(null);
                              setNewPw("");
                            }
                            return r;
                          });
                        }}
                      >
                        <input
                          className={cn(inputCls, "num w-[180px]")}
                          type="text"
                          autoComplete="off"
                          placeholder="mật khẩu mới"
                          aria-label={`Mật khẩu mới cho ${u.email}`}
                          value={newPw}
                          onChange={(e) => setNewPw(e.target.value)}
                          autoFocus
                        />
                        <Button type="submit" size="sm" variant="primary" disabled={pending || !!passwordProblem(newPw)} title={passwordProblem(newPw) ?? undefined}>
                          Lưu
                        </Button>
                        <Button size="sm" onClick={() => setResetFor(null)}>
                          Huỷ
                        </Button>
                      </form>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          onClick={() => {
                            setResetFor(u.id);
                            setNewPw("");
                          }}
                        >
                          Đặt lại mật khẩu
                        </Button>
                        {!me && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => confirm(`Xoá hẳn tài khoản ${u.email}? Các lần tải giá của họ vẫn được giữ.`) && run(() => deleteUser(u.id))}
                            className="ml-3 text-[12px] text-faint hover:text-up"
                          >
                            Xoá
                          </button>
                        )}
                      </>
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
