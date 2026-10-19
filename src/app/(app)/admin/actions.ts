"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { clearLoginFailures, clientIp, endSession, loginBlocked, noteLoginFailure, sameSecret, startSession } from "@/lib/auth";

export type AdminLoginState = { error?: string; email?: string };

const Login = z.object({ email: z.string().trim(), password: z.string() });

export async function adminLogin(_prev: AdminLoginState, form: FormData): Promise<AdminLoginState> {
  const ip = await clientIp();
  if (loginBlocked(ip)) return { error: "Sai thông tin quá nhiều lần. Thử lại sau 15 phút." };
  const { email, password } = Login.parse({ email: form.get("email") ?? "", password: form.get("password") ?? "" });
  if (!email || !password) return { error: "Nhập email và mật khẩu.", email };
  if (!z.email().safeParse(email).success) return { error: "Email không hợp lệ.", email };
  const okEmail = email.toLowerCase() === (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  // Always run the password comparison so a wrong email takes as long as a wrong password
  const okPass = sameSecret(password, process.env.ADMIN_PASSWORD);
  if (!okEmail || !okPass) {
    noteLoginFailure(ip);
    return { error: "Email hoặc mật khẩu không đúng.", email };
  }
  clearLoginFailures(ip);
  await startSession("admin", email);
  revalidatePath("/admin");
  return {};
}

/** Back to a plain viewer session */
export async function adminLogout(): Promise<void> {
  await endSession();
  await startSession("viewer");
  revalidatePath("/admin");
}
