"use client";

import { MenuIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { GigabyteLogo } from "@/components/brand/gigabyte-logo";
import { cn } from "@/lib/utils";

import { NAV_GROUPS, isActive } from "./nav";
import { QuickSearch } from "./quick-search";
import { UserMenu, type HeaderUser } from "./user-menu";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex min-w-0 items-center gap-3 text-white", className)} aria-label="GIGABYTE Monitor Matrix, về Tổng quan">
      <GigabyteLogo className="h-4 w-auto shrink-0" />
      <span aria-hidden className="h-5 w-px bg-white/30 max-sm:hidden" />
      <span className="text-[14px] font-extrabold tracking-wide whitespace-nowrap max-sm:sr-only">Monitor Matrix</span>
    </Link>
  );
}

/** Black badge bar with the INFINITY gradient rule, as on vnpromotion */
export function HeaderBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 bg-nav bg-(image:--badge-gradient) text-white",
        "after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-(image:--infinity-gradient)",
        className,
      )}
    >
      {children}
    </header>
  );
}

export function Header({ user, showAdmin }: { user: HeaderUser; showAdmin: boolean }) {
  const pathname = usePathname();
  const [drawerFor, setDrawerFor] = useState<string | null>(null);
  // The phone menu belongs to the page it was opened on: navigating closes it
  const drawer = drawerFor === pathname;

  useEffect(() => {
    if (!drawer) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setDrawerFor(null);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [drawer]);

  return (
    <>
      <HeaderBar>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 pt-2.5 pb-3 md:min-h-[59px] md:flex-nowrap md:gap-x-6 md:px-6 md:pb-[13px]">
          <button
            type="button"
            onClick={() => setDrawerFor(pathname)}
            aria-label="Mở menu"
            className="flex size-8 items-center justify-center rounded-ctl border border-white/30 bg-white/10 md:hidden"
          >
            <MenuIcon className="size-4" />
          </button>
          <Logo />
          <div className="ml-auto md:hidden">
            <UserMenu user={user} />
          </div>
          <div className="flex w-full items-center gap-2 md:ml-auto md:w-auto">
            <div className="min-w-0 flex-1 md:w-[300px] md:flex-initial">
              <QuickSearch />
            </div>
            <div className="max-md:hidden">
              <UserMenu user={user} />
            </div>
          </div>
        </div>
      </HeaderBar>

      {drawer && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Đóng menu" className="absolute inset-0 bg-outer/70" onClick={() => setDrawerFor(null)} />
          <div className="absolute inset-y-0 left-0 flex w-[min(280px,85vw)] flex-col border-r border-line bg-app shadow-pop">
            <div className="flex items-center justify-between border-b border-line px-3.5 py-3">
              <span className="text-[13px] font-bold text-fg">Menu</span>
              <button type="button" onClick={() => setDrawerFor(null)} aria-label="Đóng menu" className="flex size-8 items-center justify-center rounded-ctl text-fg-2 hover:text-fg">
                <XIcon className="size-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-2">
              <NavList pathname={pathname} showAdmin={showAdmin} collapsed={false} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function NavList({ pathname, showAdmin, collapsed }: { pathname: string; showAdmin: boolean; collapsed: boolean }) {
  return (
    <nav aria-label="Màn hình" className="flex flex-col gap-4">
      {NAV_GROUPS.map((g) => {
        const links = g.links.filter((l) => !l.manage || showAdmin);
        if (!links.length) return null;
        return (
          <div key={g.label} className="flex flex-col gap-1">
            <p className={cn("mb-0.5 px-3 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase", collapsed && "sr-only")}>{g.label}</p>
            {links.map(({ href, label, Icon }) => {
              const current = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={current ? "page" : undefined}
                  title={collapsed ? label : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-panel px-3 py-2 text-[13px] font-semibold transition-colors",
                    collapsed && "justify-center px-0",
                    current ? "bg-accent text-on-accent" : "text-fg-2 hover:bg-panel hover:text-fg",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className={cn(collapsed && "sr-only")}>{label}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
