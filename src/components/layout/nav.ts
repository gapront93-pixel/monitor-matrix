import { BarChart3Icon, GitCompareArrowsIcon, ImageIcon, LayoutDashboardIcon, MonitorIcon, ShieldIcon, ShipIcon, SwordsIcon, Table2Icon, type LucideIcon } from "lucide-react";

import type { shellMessages } from "@/lib/i18n/messages/shell";

type NavKey = keyof (typeof shellMessages)["vi"]["nav"];
export type NavLink = { href: string; label: NavKey; Icon: LucideIcon; manage?: boolean; sales?: boolean; child?: boolean };

// Screens, in menu order. "manage" and "sales" entries only show for Mod and Admin; "child" entries sit indented under the entry above.
export const NAV_GROUPS: { label: NavKey; links: NavLink[] }[] = [
  {
    label: "browse",
    links: [
      { href: "/", label: "overview", Icon: LayoutDashboardIcon },
      { href: "/products", label: "products", Icon: MonitorIcon, child: true },
      { href: "/prices", label: "prices", Icon: Table2Icon, child: true },
      { href: "/compare", label: "compare", Icon: GitCompareArrowsIcon, child: true },
      { href: "/competitors", label: "rivals", Icon: SwordsIcon, child: true },
      // Their own entries, not part of Matrix LCD
      { href: "/sales", label: "sales", Icon: BarChart3Icon, sales: true },
      { href: "/imports", label: "imports", Icon: ShipIcon, sales: true },
    ],
  },
  {
    label: "manage",
    links: [
      { href: "/admin", label: "admin", Icon: ShieldIcon, manage: true },
      { href: "/admin/images", label: "images", Icon: ImageIcon, manage: true },
    ],
  },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}
