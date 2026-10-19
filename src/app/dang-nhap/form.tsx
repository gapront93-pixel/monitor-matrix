"use client";

import { useActionState } from "react";

import { LoginCard, LoginField } from "@/components/login-card";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { shellMessages } from "@/lib/i18n/messages/shell";

import { login, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const t = useT(shellMessages).login;
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <LoginCard eyebrow={t.eyebrow} title={t.title} action={action} error={state.error}>
      <input type="hidden" name="next" value={next} />
      <LoginField label={t.email} name="email" type="email" autoComplete="username" placeholder="ten@gigabyte.vn" defaultValue={state.email} key={state.email} autoFocus />
      <LoginField label={t.password} name="password" type="password" autoComplete="current-password" />
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? t.checking : t.submit}
      </Button>
      <p className="text-[12px] text-muted">{t.help}</p>
    </LoginCard>
  );
}
