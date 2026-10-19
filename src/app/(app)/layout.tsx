import type { ReactNode } from "react";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="mx-auto w-full max-w-[1920px] flex-1 px-3.5 py-[18px] md:px-6 md:py-[22px]">{children}</main>
      <Footer />
    </div>
  );
}
