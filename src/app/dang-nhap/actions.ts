"use server";

import { redirect } from "next/navigation";

import { clearLoginFailures, clientIp, loginBlocked, noteLoginFailure, sameSecret, startSession } from "@/lib/auth";

export type LoginState = { error?: string };

/** Only same-site paths, so ?next= cannot send people elsewhere */
function safeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/dang-nhap") ? s : "/";
}

export async function viewerLogin(_prev: LoginState, form: FormData): Promise<LoginState> {
  const ip = await clientIp();
  if (loginBlocked(ip)) return { error: "Sai mật khẩu quá nhiều lần. Thử lại sau 15 phút." };
  const password = String(form.get("password") ?? "");
  if (!password) return { error: "Nhập mật khẩu." };
  if (!sameSecret(password, process.env.VIEW_PASSWORD) && !sameSecret(password, process.env.ADMIN_PASSWORD)) {
    noteLoginFailure(ip);
    return { error: "Mật khẩu không đúng." };
  }
  clearLoginFailures(ip);
  await startSession("viewer");
  redirect(safeNext(form.get("next")));
}
