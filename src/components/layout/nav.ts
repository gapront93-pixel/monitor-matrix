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
      { href: "/san-pham", label: "products", Icon: MonitorIcon, child: true },
      { href: "/bang-gia", label: "prices", Icon: Table2Icon, child: true },
      { href: "/so-sanh", label: "compare", Icon: GitCompareArrowsIcon, child: true },
      { href: "/doi-thu", label: "rivals", Icon: SwordsIcon, child: true },
      { href: "/doanh-so", label: "sales", Icon: BarChart3Icon, sales: true, child: true },
      { href: "/nhap-khau", label: "imports", Icon: ShipIcon, sales: true, child: true },
    ],
  },
  {
    label: "manage",
    links: [
      { href: "/admin", label: "admin", Icon: ShieldIcon, manage: true },
      { href: "/admin/anh", label: "images", Icon: ImageIcon, manage: true },
    ],
  },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}
