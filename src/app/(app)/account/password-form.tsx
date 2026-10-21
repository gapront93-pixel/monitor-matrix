"use client";

import { useActionState } from "react";

import { LoginField } from "@/components/login-card";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { shellMessages } from "@/lib/i18n/messages/shell";
import { MIN_PASSWORD } from "@/lib/password-rules";

import { changePassword, type PasswordState } from "./actions";

export function PasswordForm() {
  const t = useT(shellMessages).account;
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePassword, {});
  return (
    <form action={action} noValidate className="flex flex-col gap-3 rounded-panel border border-line bg-panel p-4">
      <h2 className="text-[18px] font-bold text-fg">{t.changePassword}</h2>
      <LoginField label={t.current} name="current" type="password" autoComplete="current-password" />
      <LoginField label={t.next} name="next" type="password" autoComplete="new-password" />
      <LoginField label={t.again} name="again" type="password" autoComplete="new-password" />
      <p className="text-[12px] text-muted">{t.rules(MIN_PASSWORD)}</p>
      {state.error && (
        <p role="alert" className="rounded-chip border border-err-line bg-err-bg px-2.5 py-2 text-[12.5px] text-err-title">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="rounded-chip border border-best-line bg-best-bg px-2.5 py-2 text-[12.5px] text-best">
          {t.saved}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={pending} className="self-start">
        {pending ? t.saving : t.save}
      </Button>
    </form>
  );
}
