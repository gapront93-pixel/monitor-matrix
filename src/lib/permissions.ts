// Who may do what. Pure (tested in permissions.test.ts); used by pages, server actions and API routes.

export type Role = "admin" | "mod" | "viewer";

// Labels and hints: shellMessages.roles
export const ROLES: { id: Role }[] = [{ id: "admin" }, { id: "mod" }, { id: "viewer" }];

export type Permission =
  | "view" // every screen, Excel export
  | "prices" // upload / apply / undo price files, templates
  | "unmatched" // map or dismiss unmatched rows
  | "segments" // verdict + conclusion
  | "dealers.edit" // add, rename, order, key, retail/wholesale, show/hide
  | "dealers.delete"
  | "images" // product photos: upload, auto-fetch, delete
  | "sales" // LCD sell-in from vnpromotion (customers, NPP, revenue)
  | "users";

const GRANTS: Record<Role, Permission[]> = {
  viewer: ["view"],
  mod: ["view", "prices", "unmatched", "segments", "dealers.edit", "images", "sales"],
  admin: ["view", "prices", "unmatched", "segments", "dealers.edit", "dealers.delete", "images", "sales", "users"],
};

export function can(role: Role | null | undefined, perm: Permission): boolean {
  return !!role && GRANTS[role].includes(perm);
}

/** Opens the Quản trị screen at all */
export function canManage(role: Role | null | undefined): boolean {
  return can(role, "prices") || can(role, "users");
}
