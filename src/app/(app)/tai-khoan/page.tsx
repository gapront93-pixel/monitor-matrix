import type { Metadata } from "next";

import { PageHeader, Panel } from "@/components/ui/panel";
import { requireUser } from "@/lib/auth";
import { shellMessages } from "@/lib/i18n/messages/shell";
import { getT } from "@/lib/i18n/server";

import { PasswordForm } from "./password-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT(shellMessages)).account.eyebrow };
}

export default async function AccountPage() {
  const [me, t] = await Promise.all([requireUser(), getT(shellMessages)]);
  const role = t.roles[me.role];
  return (
    <>
      <PageHeader eyebrow={t.account.eyebrow} title={me.name} sub={me.email} />
      <div className="grid items-start gap-3 md:grid-cols-[minmax(0,320px)_minmax(0,420px)]">
        <Panel className="p-4">
          <div className="eyebrow mb-1">{t.account.role}</div>
          <div className="text-[15px] font-bold text-fg">{role.label}</div>
          <p className="mt-1 text-[12.5px] text-muted">{role.hint}.</p>
          <p className="mt-3 text-[12px] text-faint">{t.account.contactAdmin}</p>
        </Panel>
        <PasswordForm />
      </div>
    </>
  );
}
