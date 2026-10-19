import type { Metadata } from "next";

import { ImportView } from "@/components/imports/import-view";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { requireUser } from "@/lib/auth";
import { importInfo } from "@/lib/import-file";
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
  const { latest } = await importInfo();
  return (
    <>
      <PageHeader eyebrow={t.eyebrow} title={t.heading} sub={t.sub(latest)} actions={<span className="text-[14px] text-muted">{t.source(latest)}</span>} />
      <ImportView />
    </>
  );
}
