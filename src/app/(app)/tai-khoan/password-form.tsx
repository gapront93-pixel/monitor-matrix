"use client";

import { useActionState } from "react";

import { LoginField } from "@/components/login-card";
import { Button } from "@/components/ui/button";
import { MIN_PASSWORD } from "@/lib/password-rules";

import { changePassword, type PasswordState } from "./actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePassword, {});
  return (
    <form action={action} noValidate className="flex flex-col gap-3 rounded-panel border border-line bg-panel p-4">
      <h2 className="text-[15px] font-bold text-fg">Đổi mật khẩu</h2>
      <LoginField label="Mật khẩu hiện tại" name="current" type="password" autoComplete="current-password" />
      <LoginField label="Mật khẩu mới" name="next" type="password" autoComplete="new-password" />
      <LoginField label="Nhập lại mật khẩu mới" name="again" type="password" autoComplete="new-password" />
      <p className="text-[12px] text-muted">Ít nhất {MIN_PASSWORD} ký tự, có cả chữ và số. Các thiết bị khác đang đăng nhập bằng tài khoản này sẽ bị đăng xuất.</p>
      {state.error && (
        <p role="alert" className="rounded-chip border border-err-line bg-err-bg px-2.5 py-2 text-[12.5px] text-err-title">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="rounded-chip border border-best-line bg-best-bg px-2.5 py-2 text-[12.5px] text-best">
          Đã đổi mật khẩu.
        </p>
      )}
      <Button type="submit" variant="primary" disabled={pending} className="self-start">
        {pending ? "Đang lưu …" : "Lưu mật khẩu mới"}
      </Button>
    </form>
  );
}
