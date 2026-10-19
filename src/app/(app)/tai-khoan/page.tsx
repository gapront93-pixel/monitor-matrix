import type { Metadata } from "next";

import { PageHeader, Panel } from "@/components/ui/panel";
import { requireUser } from "@/lib/auth";
import { ROLES } from "@/lib/permissions";

import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Tài khoản" };

export default async function AccountPage() {
  const me = await requireUser();
  const role = ROLES.find((r) => r.id === me.role)!;
  return (
    <>
      <PageHeader eyebrow="Tài khoản" title={me.name} sub={me.email} />
      <div className="grid items-start gap-3 md:grid-cols-[minmax(0,320px)_minmax(0,420px)]">
        <Panel className="p-4">
          <div className="eyebrow mb-1">Vai trò</div>
          <div className="text-[15px] font-bold text-fg">{role.label}</div>
          <p className="mt-1 text-[12.5px] text-muted">{role.hint}.</p>
          <p className="mt-3 text-[12px] text-faint">Đổi tên, email hoặc vai trò: liên hệ Admin.</p>
        </Panel>
        <PasswordForm />
      </div>
    </>
  );
}
