"use client";

import { useActionState } from "react";

import { LoginCard, LoginField } from "@/components/login-card";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { shellMessages } from "@/lib/i18n/messages/shell";

import { login, type LoginState } from "./actions";
import { GoogleButton } from "./google-button";

/** `google`: show the Google button (set in .env); `oauthError`: why the last Google attempt bounced back */
export function LoginForm({ next, google, oauthError }: { next: string; google: boolean; oauthError?: string }) {
  const t = useT(shellMessages).login;
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <LoginCard eyebrow={t.eyebrow} title={t.title} action={action} error={state.error ?? oauthError}>
      <input type="hidden" name="next" value={next} />
      <LoginField label={t.email} name="email" type="email" autoComplete="username" placeholder="ten@gigabyte.vn" defaultValue={state.email} key={state.email} autoFocus />
      <LoginField label={t.password} name="password" type="password" autoComplete="current-password" />
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? t.checking : t.submit}
      </Button>
      {google && (
        <>
          <div className="flex items-center gap-2.5 text-[11.5px] text-faint">
            <span className="h-px flex-1 bg-line" />
            {t.or}
            <span className="h-px flex-1 bg-line" />
          </div>
          <GoogleButton label={t.google} next={next} />
        </>
      )}
      <p className="text-[12px] text-muted">{t.help}</p>
    </LoginCard>
  );
}
