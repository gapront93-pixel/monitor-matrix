"use client";

import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

import { NavList } from "./header";

// Collapsed state is a per-browser convenience (wide price grids need the room)
const KEY = "mm-sidebar-collapsed";
const EVENT = "mm-sidebar";

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

/** Side menu on wide screens; phones use the ☰ menu in the header */
export function Sidebar({ showAdmin }: { showAdmin: boolean }) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribe, read, () => false);
  const toggle = () => {
    try {
      localStorage.setItem(KEY, collapsed ? "0" : "1");
    } catch {
      // storage blocked: the menu simply stays as it is
    }
    window.dispatchEvent(new Event(EVENT));
  };

  return (
    <aside className={cn("shrink-0 transition-[width] max-md:hidden", collapsed ? "w-12" : "w-56")}>
      <div className="sticky top-[78px] flex flex-col gap-4">
        <NavList pathname={pathname} showAdmin={showAdmin} collapsed={collapsed} />
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
          title={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
          className={cn("flex items-center gap-2.5 rounded-panel px-3 py-2 text-[12.5px] text-muted hover:bg-panel hover:text-fg", collapsed && "justify-center px-0")}
        >
          {collapsed ? <PanelLeftOpenIcon className="size-4" /> : <PanelLeftCloseIcon className="size-4" />}
          <span className={cn(collapsed && "sr-only")}>Thu gọn menu</span>
        </button>
      </div>
    </aside>
  );
}
