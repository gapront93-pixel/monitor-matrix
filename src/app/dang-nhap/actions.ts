"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { clearLoginFailures, clientIp, endSession, loginBlocked, noteLoginFailure, startSession } from "@/lib/auth";
import { DUMMY_HASH, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export type LoginState = { error?: string; email?: string };

/** Only same-site paths, so ?next= cannot send people elsewhere */
function safeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/dang-nhap") ? s : "/";
}

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const ip = await clientIp();
  if (loginBlocked(ip) || loginBlocked(email)) return { error: "Sai thông tin quá nhiều lần. Thử lại sau 15 phút.", email };
  if (!email || !password) return { error: "Nhập email và mật khẩu.", email };
  if (!z.email().safeParse(email).success) return { error: "Email không hợp lệ.", email };

  const user = await prisma.user.findUnique({ where: { email } });
  // Always hash once, so an unknown email takes as long as a wrong password
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    noteLoginFailure(ip);
    noteLoginFailure(email);
    return { error: "Email hoặc mật khẩu không đúng.", email };
  }
  if (!user.active) return { error: "Tài khoản này đã bị khoá. Liên hệ Admin.", email };

  clearLoginFailures(ip);
  clearLoginFailures(email);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await startSession(user);
  redirect(safeNext(form.get("next")));
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/dang-nhap");
}
