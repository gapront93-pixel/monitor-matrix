import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";
import { getSession } from "@/lib/auth";

import { adminLogout } from "./actions";
import { AdminLoginForm } from "./login-form";

export const metadata: Metadata = { title: "Quản trị" };

export default async function AdminPage() {
  const session = await getSession();
  if (session?.role !== "admin") return <AdminLoginForm />;
  return (
    <>
      <PageHeader
        eyebrow="Quản trị"
        title="Dữ liệu giá và đại lý"
        actions={
          <form action={adminLogout} className="flex items-center gap-3">
            <span className="text-[12.5px] text-muted">{session.email}</span>
            <Button type="submit" size="sm">
              Đăng xuất
            </Button>
          </form>
        }
      />
      <EmptyState title="Đang xây dựng">Phần tải file giá và quản lý đại lý sẽ có ở bước Quản trị.</EmptyState>
    </>
  );
}
