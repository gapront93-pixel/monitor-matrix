import type { ReactNode } from "react";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { requireUser } from "@/lib/auth";
import { getTheme } from "@/lib/i18n/server";
import { can, canManage } from "@/lib/permissions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // The proxy only checks the cookie signature; this re-checks the account (locked, role changed, password reset)
  const [user, theme] = await Promise.all([requireUser(), getTheme()]);
  const showAdmin = canManage(user.role);
  const showSales = can(user.role, "sales");
  return (
    <div className="flex min-h-dvh flex-col">
      <Header user={{ name: user.name, email: user.email, role: user.role }} showAdmin={showAdmin} showSales={showSales} theme={theme} />
      <div className="mx-auto flex w-full max-w-[1920px] min-w-0 flex-1 gap-6 px-3.5 py-[18px] md:px-6 md:py-[22px]">
        <Sidebar showAdmin={showAdmin} showSales={showSales} />
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
      <Footer />
    </div>
  );
}
