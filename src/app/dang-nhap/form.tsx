"use client";

import { useActionState } from "react";

import { LoginCard, LoginField } from "@/components/login-card";
import { Button } from "@/components/ui/button";

import { login, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <LoginCard eyebrow="Công cụ nội bộ" title="Đăng nhập" action={action} error={state.error}>
      <input type="hidden" name="next" value={next} />
      <LoginField label="Email" name="email" type="email" autoComplete="username" placeholder="ten@gigabyte.vn" defaultValue={state.email} key={state.email} autoFocus />
      <LoginField label="Mật khẩu" name="password" type="password" autoComplete="current-password" />
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? "Đang kiểm tra …" : "Đăng nhập"}
      </Button>
      <p className="text-[12px] text-muted">Chưa có tài khoản hoặc quên mật khẩu? Liên hệ Admin của công cụ.</p>
    </LoginCard>
  );
}
