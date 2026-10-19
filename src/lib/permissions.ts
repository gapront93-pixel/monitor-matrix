// Who may do what. Pure (tested in permissions.test.ts); used by pages, server actions and API routes.

export type Role = "admin" | "mod" | "viewer";

export const ROLES: { id: Role; label: string; hint: string }[] = [
  { id: "admin", label: "Admin", hint: "Mọi quyền, kể cả xoá đại lý và quản lý người dùng" },
  { id: "mod", label: "Mod", hint: "Cập nhật giá, ảnh sản phẩm, sửa đại lý, sửa phân khúc, gắn dòng chưa khớp" },
  { id: "viewer", label: "Viewer", hint: "Chỉ xem và xuất Excel" },
];

export type Permission =
  | "view" // every screen, Excel export
  | "prices" // upload / apply / undo price files, templates
  | "unmatched" // map or dismiss unmatched rows
  | "segments" // verdict + conclusion
  | "dealers.edit" // add, rename, order, key, retail/wholesale, show/hide
  | "dealers.delete"
  | "images" // product photos: upload, auto-fetch, delete
  | "users";

const GRANTS: Record<Role, Permission[]> = {
  viewer: ["view"],
  mod: ["view", "prices", "unmatched", "segments", "dealers.edit", "images"],
  admin: ["view", "prices", "unmatched", "segments", "dealers.edit", "dealers.delete", "images", "users"],
};

export function can(role: Role | null | undefined, perm: Permission): boolean {
  return !!role && GRANTS[role].includes(perm);
}

/** Opens the Quản trị screen at all */
export function canManage(role: Role | null | undefined): boolean {
  return can(role, "prices") || can(role, "users");
}

export function roleLabel(role: Role): string {
  return ROLES.find((r) => r.id === role)?.label ?? role;
}
