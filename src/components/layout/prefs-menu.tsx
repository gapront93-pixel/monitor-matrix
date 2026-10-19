"use client";

import { CheckIcon, LanguagesIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";

import { LOCALE_NAMES, LOCALES, type Locale, type Theme } from "@/lib/i18n/config";
import { useLocale, useT } from "@/lib/i18n/client";
import { shellMessages } from "@/lib/i18n/messages/shell";
import { setLocale, setTheme } from "@/lib/i18n/prefs-actions";
import { cn } from "@/lib/utils";

function Menu({ label, icon, children }: { label: string; icon: ReactNode; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={label}
        title={label}
        className="flex size-8 items-center justify-center rounded-ctl border border-white/30 bg-white/10 text-white hover:bg-white/20"
      >
        {icon}
      </button>
      {open && (
        <div role="menu" className="absolute top-[calc(100%+6px)] right-0 z-50 w-[190px] rounded-ctl border border-line bg-panel p-1.5 shadow-pop">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function Item({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className={cn("flex w-full items-center gap-2 rounded-chip px-2.5 py-2 text-left text-[13px] hover:bg-row-a", active ? "font-semibold text-fg" : "text-fg-2")}
    >
      <span className="flex-1">{children}</span>
      {active && <CheckIcon className="size-4 text-accent" />}
    </button>
  );
}

/** Language and light/dark pickers on the black header bar, as on vnpromotion */
export function PrefsMenu({ theme: initial }: { theme: Theme }) {
  const t = useT(shellMessages);
  const locale = useLocale();
  const router = useRouter();
  const [, start] = useTransition();
  const [theme, setThemeState] = useState<Theme>(initial);

  const pickTheme = (v: Theme) => {
    setThemeState(v);
    document.documentElement.setAttribute("data-theme", v); // instant; the cookie keeps it for the next page load
    start(() => setTheme(v));
  };
  const pickLocale = (v: Locale) =>
    start(async () => {
      await setLocale(v);
      router.refresh();
    });

  const ThemeIcon = theme === "light" ? SunIcon : theme === "system" ? MonitorIcon : MoonIcon;
  return (
    <>
      <Menu label={t.language} icon={<LanguagesIcon className="size-4" />}>
        {(close) =>
          LOCALES.map((l) => (
            <Item
              key={l}
              active={l === locale}
              onClick={() => {
                close();
                if (l !== locale) pickLocale(l);
              }}
            >
              {LOCALE_NAMES[l]}
            </Item>
          ))
        }
      </Menu>
      <Menu label={t.theme.label} icon={<ThemeIcon className="size-4" />}>
        {(close) =>
          (["light", "dark", "system"] as const).map((v) => (
            <Item
              key={v}
              active={v === theme}
              onClick={() => {
                close();
                pickTheme(v);
              }}
            >
              {t.theme[v]}
            </Item>
          ))
        }
      </Menu>
    </>
  );
}
