"use client";

import { useActionState } from "react";

import { LoginCard, LoginField } from "@/components/login-card";
import { Button } from "@/components/ui/button";

import { adminLogin, type AdminLoginState } from "./actions";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState<AdminLoginState, FormData>(adminLogin, {});
  return (
    <div className="flex justify-center pt-12">
      <LoginCard eyebrow="Quản trị" title="Đăng nhập" action={action} error={state.error}>
        <LoginField label="Email" name="email" type="email" autoComplete="username" placeholder="ten@gigabyte.vn" defaultValue={state.email} key={state.email} />
        <LoginField label="Mật khẩu" name="password" type="password" autoComplete="current-password" />
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
          {pending ? "Đang kiểm tra …" : "Đăng nhập"}
        </Button>
      </LoginCard>
    </div>
  );
}
