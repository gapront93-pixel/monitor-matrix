"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { logout } from "@/app/dang-nhap/actions";
import { useT } from "@/lib/i18n/client";
import { shellMessages } from "@/lib/i18n/messages/shell";
import type { Role } from "@/lib/permissions";

export type HeaderUser = { name: string; email: string; role: Role };

/** Initials button with name, role, account page and logout */
export function UserMenu({ user }: { user: HeaderUser }) {
  const t = useT(shellMessages);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const initials =
    user.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(-2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?";
  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t.user.account(user.name)}
        className="flex size-8 items-center justify-center rounded-full border border-white/30 bg-white/10 text-[11.5px] font-bold text-white hover:bg-white/20"
      >
        {initials}
      </button>
      {open && (
        <div className="absolute top-[calc(100%+6px)] right-0 z-50 w-[240px] rounded-ctl border border-line bg-panel p-1.5 shadow-pop">
          <div className="border-b border-line-2 px-2.5 pt-1.5 pb-2.5">
            <div className="truncate text-[13px] font-semibold text-fg">{user.name}</div>
            <div className="truncate text-[11.5px] text-muted">{user.email}</div>
            <div className="mt-1 text-[11px] font-semibold text-fg-2">{t.user.role(t.roles[user.role].label)}</div>
          </div>
          <Link href="/tai-khoan" onClick={() => setOpen(false)} className="mt-1 block rounded-chip px-2.5 py-2 text-[13px] text-fg hover:bg-row-a">
            {t.user.accountLink}
          </Link>
          <form action={logout}>
            <button type="submit" className="block w-full rounded-chip px-2.5 py-2 text-left text-[13px] text-fg hover:bg-row-a">
              {t.user.signOut}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
