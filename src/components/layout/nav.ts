import { GitCompareArrowsIcon, ImageIcon, LayoutDashboardIcon, MonitorIcon, ShieldIcon, SwordsIcon, Table2Icon, type LucideIcon } from "lucide-react";

export type NavLink = { href: string; label: string; Icon: LucideIcon; manage?: boolean };

// Screens, in menu order. "manage" entries only show for Mod and Admin.
export const NAV_GROUPS: { label: string; links: NavLink[] }[] = [
  {
    label: "Tra cứu",
    links: [
      { href: "/", label: "Tổng quan", Icon: LayoutDashboardIcon },
      { href: "/san-pham", label: "Sản phẩm", Icon: MonitorIcon },
      { href: "/bang-gia", label: "Bảng giá", Icon: Table2Icon },
      { href: "/so-sanh", label: "So sánh", Icon: GitCompareArrowsIcon },
      { href: "/doi-thu", label: "Đối thủ", Icon: SwordsIcon },
    ],
  },
  {
    label: "Quản lý",
    links: [
      { href: "/admin", label: "Quản trị", Icon: ShieldIcon, manage: true },
      { href: "/admin/anh", label: "Ảnh sản phẩm", Icon: ImageIcon, manage: true },
    ],
  },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}
