"use client";

import { usePathname } from "next/navigation";

import { NavList } from "./header";

/** Side menu on wide screens; phones use the ☰ menu in the header */
export function Sidebar({ showAdmin, showSales }: { showAdmin: boolean; showSales: boolean }) {
  const pathname = usePathname();
  return (
    <aside className="w-56 shrink-0 max-md:hidden">
      <div className="sticky top-[78px]">
        <NavList pathname={pathname} showAdmin={showAdmin} showSales={showSales} />
      </div>
    </aside>
  );
}
