"use client";

import { useActionState } from "react";

import { LoginCard, LoginField } from "@/components/login-card";
import { Button } from "@/components/ui/button";

import { viewerLogin, type LoginState } from "./actions";

export function ViewerLoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(viewerLogin, {});
  return (
    <LoginCard eyebrow="Công cụ nội bộ" title="Đăng nhập" action={action} error={state.error}>
      <input type="hidden" name="next" value={next} />
      <LoginField label="Mật khẩu" name="password" type="password" autoComplete="current-password" autoFocus />
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? "Đang kiểm tra …" : "Đăng nhập"}
      </Button>
      <p className="text-[12px] text-muted">Hỏi quản trị viên nếu bạn chưa có mật khẩu.</p>
    </LoginCard>
  );
}
