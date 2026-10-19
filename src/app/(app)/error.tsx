"use client";

import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { useT } from "@/lib/i18n/client";
import { shellMessages } from "@/lib/i18n/messages/shell";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT(shellMessages).states;
  return (
    <ErrorState
      title={t.errorTitle}
      code={error.digest ? t.errorCode(error.digest) : undefined}
      action={
        <>
          <Button variant="primary" size="sm" onClick={reset}>
            {t.retry}
          </Button>
          <ButtonLink href="/" size="sm">
            {t.home}
          </ButtonLink>
        </>
      }
    >
      {t.errorText}
    </ErrorState>
  );
}
