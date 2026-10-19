"use client";

import { MenuIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { GigabyteLogo } from "@/components/brand/gigabyte-logo";
import type { Theme } from "@/lib/i18n/config";
import { useT } from "@/lib/i18n/client";
import { shellMessages } from "@/lib/i18n/messages/shell";
import { cn } from "@/lib/utils";

import { NAV_GROUPS, isActive, type NavLink } from "./nav";
import { PrefsMenu } from "./prefs-menu";
import { UserMenu, type HeaderUser } from "./user-menu";

export function Logo({ className }: { className?: string }) {
  const t = useT(shellMessages);
  return (
    <Link href="/" className={cn("flex min-w-0 items-center gap-3 text-white", className)} aria-label={t.homeLabel}>
      <GigabyteLogo className="h-4 w-auto shrink-0" />
      <span aria-hidden className="h-5 w-px bg-white/30 max-sm:hidden" />
      <span className="text-[14px] font-extrabold tracking-wide whitespace-nowrap max-sm:sr-only">{t.appTitle}</span>
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

export function Header({ user, showAdmin, showSales, theme }: { user: HeaderUser; showAdmin: boolean; showSales: boolean; theme: Theme }) {
  const t = useT(shellMessages);
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
        <div className="flex min-h-[59px] items-center gap-x-3 px-3.5 pt-2.5 pb-3 md:gap-x-6 md:px-6 md:pb-[13px]">
          <button
            type="button"
            onClick={() => setDrawerFor(pathname)}
            aria-label={t.openMenu}
            className="flex size-8 items-center justify-center rounded-ctl border border-white/30 bg-white/10 md:hidden"
          >
            <MenuIcon className="size-4" />
          </button>
          <Logo />
          <div className="ml-auto flex items-center gap-2">
            <PrefsMenu theme={theme} />
            <UserMenu user={user} />
          </div>
        </div>
      </HeaderBar>

      {drawer && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label={t.menu}>
          <button type="button" aria-label={t.closeMenu} className="absolute inset-0 bg-outer/70" onClick={() => setDrawerFor(null)} />
          <div className="absolute inset-y-0 left-0 flex w-[min(280px,85vw)] flex-col border-r border-line bg-app shadow-pop">
            <div className="flex items-center justify-between border-b border-line px-3.5 py-3">
              <span className="text-[13px] font-bold text-fg">{t.menu}</span>
              <button type="button" onClick={() => setDrawerFor(null)} aria-label={t.closeMenu} className="flex size-8 items-center justify-center rounded-ctl text-fg-2 hover:text-fg">
                <XIcon className="size-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-2">
              <NavList pathname={pathname} showAdmin={showAdmin} showSales={showSales} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Consecutive links grouped by level, so the sub-entries of one parent share a block */
function blocks(links: NavLink[]): { child: boolean; links: NavLink[] }[] {
  const out: { child: boolean; links: NavLink[] }[] = [];
  for (const l of links) {
    const last = out.at(-1);
    if (last && last.child === !!l.child) last.links.push(l);
    else out.push({ child: !!l.child, links: [l] });
  }
  return out;
}

export function NavList({ pathname, showAdmin, showSales }: { pathname: string; showAdmin: boolean; showSales: boolean }) {
  const t = useT(shellMessages);
  const item = ({ href, label, Icon }: NavLink, child: boolean) => {
    const current = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={current ? "page" : undefined}
        className={cn(
          "flex items-center gap-2.5 rounded-panel px-3 font-semibold transition-colors",
          child ? "py-1.5 text-[12.5px]" : "py-2 text-[13px]",
          current ? "bg-accent text-on-accent" : "text-fg-2 hover:bg-panel hover:text-fg",
        )}
      >
        <Icon className={cn("shrink-0", child ? "size-3.5" : "size-4")} />
        {t.nav[label]}
      </Link>
    );
  };
  return (
    <nav aria-label={t.nav.label} className="flex flex-col gap-4">
      {NAV_GROUPS.map((g) => {
        const links = g.links.filter((l) => (!l.manage || showAdmin) && (!l.sales || showSales));
        if (!links.length) return null;
        return (
          <div key={g.label} className="flex flex-col gap-1">
            <p className="mb-0.5 px-3 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{t.nav[g.label]}</p>
            {blocks(links).map((block) =>
              block.child ? (
                // Sub-entries sit indented behind one guide line, so they read as part of the entry above
                <div key={block.links[0].href} className="ml-[21px] flex flex-col gap-0.5 border-l border-line pl-2">
                  {block.links.map((l) => item(l, true))}
                </div>
              ) : (
                block.links.map((l) => item(l, false))
              ),
            )}
          </div>
        );
      })}
    </nav>
  );
}
