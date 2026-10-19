"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { userWith } from "@/lib/auth";
import { hashPassword, passwordProblem } from "@/lib/password";
import { prisma } from "@/lib/prisma";

import type { ActionResult } from "./data-actions";

const fail = (error: string): ActionResult => ({ ok: false, error });
const ok = (message?: string): ActionResult => {
  revalidatePath("/admin");
  return { ok: true, message };
};

const Role = z.enum(["admin", "mod", "viewer"]);
const NewUser = z.object({
  name: z.string().trim().min(1, "Nhập tên.").max(80),
  email: z.email("Email không hợp lệ.").transform((v) => v.trim().toLowerCase()),
  role: Role,
  password: z.string(),
});

async function admins(excludeId?: number): Promise<number> {
  return prisma.user.count({ where: { role: "admin", active: true, ...(excludeId ? { id: { not: excludeId } } : {}) } });
}

export async function createUser(input: z.input<typeof NewUser>): Promise<ActionResult> {
  if (!(await userWith("users"))) return fail("Chỉ Admin được quản lý người dùng.");
  const p = NewUser.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const weak = passwordProblem(p.data.password);
  if (weak) return fail(weak);
  if (await prisma.user.findUnique({ where: { email: p.data.email } })) return fail("Email này đã có tài khoản.");
  await prisma.user.create({ data: { name: p.data.name, email: p.data.email, role: p.data.role, passwordHash: await hashPassword(p.data.password) } });
  return ok(`Đã tạo tài khoản ${p.data.email}. Gửi email và mật khẩu cho người dùng; họ có thể tự đổi mật khẩu ở trang Tài khoản.`);
}

const Patch = z.object({ name: z.string().trim().min(1, "Tên không được trống.").max(80).optional(), role: Role.optional(), active: z.boolean().optional() });

export async function updateUser(id: number, patch: z.input<typeof Patch>): Promise<ActionResult> {
  const me = await userWith("users");
  if (!me) return fail("Chỉ Admin được quản lý người dùng.");
  const p = Patch.safeParse(patch);
  if (!p.success) return fail(p.error.issues[0].message);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return fail("Không tìm thấy người dùng.");
  const losesAdmin = user.role === "admin" && user.active && ((p.data.role && p.data.role !== "admin") || p.data.active === false);
  if (id === me.id && (losesAdmin || p.data.active === false)) return fail("Không thể tự hạ quyền hoặc tự khoá tài khoản của chính mình.");
  if (losesAdmin && (await admins(id)) === 0) return fail("Phải còn ít nhất một Admin đang hoạt động.");
  // A role change or lock ends that person's open sessions at once
  const endSessions = (p.data.role && p.data.role !== user.role) || p.data.active === false;
  await prisma.user.update({ where: { id }, data: { ...p.data, ...(endSessions ? { sessionVersion: { increment: 1 } } : {}) } });
  const roleNames = { admin: "Admin", mod: "Mod", viewer: "Viewer" } as const;
  return ok(
    p.data.active === false
      ? `Đã khoá ${user.email}.`
      : p.data.active === true
        ? `Đã mở khoá ${user.email}.`
        : p.data.role && p.data.role !== user.role
          ? `${user.email} giờ là ${roleNames[p.data.role]}. Họ cần đăng nhập lại.`
          : undefined,
  );
}

export async function resetPassword(id: number, password: string): Promise<ActionResult> {
  if (!(await userWith("users"))) return fail("Chỉ Admin được quản lý người dùng.");
  const weak = passwordProblem(password);
  if (weak) return fail(weak);
  const user = await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(password), sessionVersion: { increment: 1 } } }).catch(() => null);
  if (!user) return fail("Không tìm thấy người dùng.");
  return ok(`Đã đặt mật khẩu mới cho ${user.email}. Các phiên đăng nhập cũ của họ đã bị đăng xuất.`);
}

export async function deleteUser(id: number): Promise<ActionResult> {
  const me = await userWith("users");
  if (!me) return fail("Chỉ Admin được quản lý người dùng.");
  if (id === me.id) return fail("Không thể xoá tài khoản của chính mình.");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return fail("Không tìm thấy người dùng.");
  if (user.role === "admin" && user.active && (await admins(id)) === 0) return fail("Phải còn ít nhất một Admin đang hoạt động.");
  await prisma.user.delete({ where: { id } }); // their price uploads stay, without a name
  return ok(`Đã xoá ${user.email}.`);
}
