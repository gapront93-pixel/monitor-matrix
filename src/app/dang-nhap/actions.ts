"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { clearLoginFailures, clientIp, endSession, loginBlocked, noteLoginFailure, startSession } from "@/lib/auth";
import { shellMessages } from "@/lib/i18n/messages/shell";
import { getT } from "@/lib/i18n/server";
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
  const [ip, { login: t }] = await Promise.all([clientIp(), getT(shellMessages)]);
  if (loginBlocked(ip) || loginBlocked(email)) return { error: t.blocked, email };
  if (!email || !password) return { error: t.missing, email };
  if (!z.email().safeParse(email).success) return { error: t.badEmail, email };

  const user = await prisma.user.findUnique({ where: { email } });
  // Always hash once, so an unknown email takes as long as a wrong password
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    noteLoginFailure(ip);
    noteLoginFailure(email);
    return { error: t.wrong, email };
  }
  if (!user.active) return { error: t.locked, email };

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
