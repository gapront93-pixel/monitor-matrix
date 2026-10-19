import type { ReactNode } from "react";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { requireUser } from "@/lib/auth";
import { canManage } from "@/lib/permissions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // The proxy only checks the cookie signature; this re-checks the account (locked, role changed, password reset)
  const user = await requireUser();
  return (
    <div className="flex min-h-dvh flex-col">
      <Header user={{ name: user.name, email: user.email, role: user.role }} showAdmin={canManage(user.role)} />
      <main className="mx-auto w-full max-w-[1920px] flex-1 px-3.5 py-[18px] md:px-6 md:py-[22px]">{children}</main>
      <Footer />
    </div>
  );
}
