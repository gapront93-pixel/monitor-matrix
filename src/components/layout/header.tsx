"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { QuickSearch } from "./quick-search";

const TABS = [
  { href: "/", label: "Tổng quan" },
  { href: "/san-pham", label: "Sản phẩm" },
  { href: "/bang-gia", label: "Bảng giá" },
  { href: "/so-sanh", label: "So sánh" },
  { href: "/doi-thu", label: "Đối thủ" },
  { href: "/admin", label: "Quản trị" },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

export function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-baseline gap-2.5 whitespace-nowrap" aria-label="GIGABYTE Monitor Matrix, về Tổng quan">
      <span className="text-[14px] font-extrabold tracking-[0.16em] text-fg">GIGABYTE</span>
      <span className="text-[12px] font-medium text-muted">Monitor Matrix</span>
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-head">
      <div className="mx-auto flex max-w-[1920px] flex-wrap items-center gap-x-6 px-3.5 md:h-[54px] md:flex-nowrap md:px-5">
        <div className="flex h-[46px] min-w-0 flex-1 items-center gap-5 md:h-full md:flex-initial">
          <Logo />
          <nav aria-label="Màn hình" className="no-scrollbar -mx-1 flex h-full min-w-0 overflow-x-auto">
            {TABS.map((t) => {
              const active = isActive(pathname, t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-full items-center px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors",
                    active ? "text-fg" : "text-fg-2 hover:text-fg",
                  )}
                >
                  {t.label}
                  {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="w-full pb-2.5 md:ml-auto md:w-[270px] md:min-w-[160px] md:shrink md:pb-0">
          <QuickSearch />
        </div>
      </div>
    </header>
  );
}
