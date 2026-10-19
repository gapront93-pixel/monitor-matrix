"use server";

import { getCurrentUser, startSession } from "@/lib/auth";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export type PasswordState = { error?: string; ok?: boolean };

/** Changes your own password; other devices are signed out, this one stays signed in */
export async function changePassword(_prev: PasswordState, form: FormData): Promise<PasswordState> {
  const me = await getCurrentUser();
  if (!me) return { error: "Phiên đăng nhập đã hết hạn. Đăng nhập lại." };
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const again = String(form.get("again") ?? "");
  if (!current || !next) return { error: "Nhập đủ mật khẩu hiện tại và mật khẩu mới." };
  if (next !== again) return { error: "Hai lần nhập mật khẩu mới không giống nhau." };
  const weak = passwordProblem(next);
  if (weak) return { error: weak };
  const user = await prisma.user.findUnique({ where: { id: me.id } });
  if (!user || !(await verifyPassword(current, user.passwordHash))) return { error: "Mật khẩu hiện tại không đúng." };
  const updated = await prisma.user.update({
    where: { id: me.id },
    data: { passwordHash: await hashPassword(next), sessionVersion: { increment: 1 } },
  });
  await startSession(updated);
  return { ok: true };
}
