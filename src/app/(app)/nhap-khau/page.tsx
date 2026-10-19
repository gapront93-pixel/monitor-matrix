import type { Metadata } from "next";

import { ImportView } from "@/components/imports/import-view";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { requireUser } from "@/lib/auth";
import { importsMessages } from "@/lib/i18n/messages/imports";
import { getLocale, getT } from "@/lib/i18n/server";
import { can } from "@/lib/permissions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT(importsMessages)).title };
}

export default async function ImportsPage() {
  const [me, t, locale] = await Promise.all([requireUser(), getT(importsMessages), getLocale()]);
  if (!can(me.role, "sales")) {
    return (
      <EmptyState
        title={t.noAccess}
        action={
          <ButtonLink href="/" variant="primary" size="sm">
            {locale === "vi" ? "Về Matrix LCD" : "Back to Matrix LCD"}
          </ButtonLink>
        }
      >
        {t.noAccessText}
      </EmptyState>
    );
  }
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="w-fit bg-(image:--infinity-gradient) bg-clip-text font-aldrich text-[14px] font-semibold tracking-[0.18em] text-transparent">
            {t.eyebrow}
          </span>
          <h1 className="font-aldrich text-[30px] leading-[1.15] tracking-[0.01em] text-fg md:text-[44px]">{t.heading}</h1>
          <span className="text-[15px] text-muted">{t.sub}</span>
        </div>
        <span className="text-[14px] text-muted">{t.source}</span>
      </div>
      <ImportView />
    </>
  );
}
