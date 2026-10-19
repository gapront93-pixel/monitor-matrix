"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { userWith } from "@/lib/auth";
import { adminMessages } from "@/lib/i18n/messages/admin";
import { shellMessages } from "@/lib/i18n/messages/shell";
import { getT } from "@/lib/i18n/server";
import { hashPassword, passwordProblem } from "@/lib/password";
import { passwordMessage } from "@/lib/password-rules";
import { prisma } from "@/lib/prisma";

import type { ActionResult } from "./data-actions";

type Role = "admin" | "mod" | "viewer";

const fail = (error: string): ActionResult => ({ ok: false, error });
const ok = (message?: string): ActionResult => {
  revalidatePath("/admin");
  return { ok: true, message };
};

async function words() {
  const [a, s] = await Promise.all([getT(adminMessages), getT(shellMessages)]);
  return { t: a.actions, shell: s };
}

async function admins(excludeId?: number): Promise<number> {
  return prisma.user.count({ where: { role: "admin", active: true, ...(excludeId ? { id: { not: excludeId } } : {}) } });
}

export async function createUser(input: { name: string; email: string; role: Role; password: string }): Promise<ActionResult> {
  const { t, shell } = await words();
  if (!(await userWith("users"))) return fail(t.usersOnly);
  const p = z
    .object({
      name: z.string().trim().min(1, t.nameNeeded).max(80),
      email: z.email(t.badEmail).transform((v) => v.trim().toLowerCase()),
      role: z.enum(["admin", "mod", "viewer"]),
      password: z.string(),
    })
    .safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const weak = passwordProblem(p.data.password);
  if (weak) return fail(passwordMessage(weak, shell.password));
  if (await prisma.user.findUnique({ where: { email: p.data.email } })) return fail(t.emailTaken);
  await prisma.user.create({ data: { name: p.data.name, email: p.data.email, role: p.data.role, passwordHash: await hashPassword(p.data.password) } });
  return ok(t.userCreated(p.data.email));
}

export async function updateUser(id: number, patch: { name?: string; role?: Role; active?: boolean }): Promise<ActionResult> {
  const { t, shell } = await words();
  const me = await userWith("users");
  if (!me) return fail(t.usersOnly);
  const p = z
    .object({ name: z.string().trim().min(1, t.nameEmpty).max(80).optional(), role: z.enum(["admin", "mod", "viewer"]).optional(), active: z.boolean().optional() })
    .safeParse(patch);
  if (!p.success) return fail(p.error.issues[0].message);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return fail(t.userNotFound);
  const losesAdmin = user.role === "admin" && user.active && ((p.data.role && p.data.role !== "admin") || p.data.active === false);
  if (id === me.id && (losesAdmin || p.data.active === false)) return fail(t.notSelf);
  if (losesAdmin && (await admins(id)) === 0) return fail(t.lastAdmin);
  // A role change or lock ends that person's open sessions at once
  const endSessions = (p.data.role && p.data.role !== user.role) || p.data.active === false;
  await prisma.user.update({ where: { id }, data: { ...p.data, ...(endSessions ? { sessionVersion: { increment: 1 } } : {}) } });
  return ok(
    p.data.active === false
      ? t.locked(user.email)
      : p.data.active === true
        ? t.unlocked(user.email)
        : p.data.role && p.data.role !== user.role
          ? t.roleChanged(user.email, shell.roles[p.data.role].label)
          : undefined,
  );
}

export async function resetPassword(id: number, password: string): Promise<ActionResult> {
  const { t, shell } = await words();
  if (!(await userWith("users"))) return fail(t.usersOnly);
  const weak = passwordProblem(password);
  if (weak) return fail(passwordMessage(weak, shell.password));
  const user = await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(password), sessionVersion: { increment: 1 } } }).catch(() => null);
  if (!user) return fail(t.userNotFound);
  return ok(t.passwordReset(user.email));
}

export async function deleteUser(id: number): Promise<ActionResult> {
  const { t } = await words();
  const me = await userWith("users");
  if (!me) return fail(t.usersOnly);
  if (id === me.id) return fail(t.notSelfDelete);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return fail(t.userNotFound);
  if (user.role === "admin" && user.active && (await admins(id)) === 0) return fail(t.lastAdmin);
  await prisma.user.delete({ where: { id } }); // their price uploads stay, without a name
  return ok(t.userDeleted(user.email));
}
