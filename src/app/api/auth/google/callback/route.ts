import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { startSession } from "@/lib/auth";
import { GOOGLE_STATE_COOKIE, googleConfig } from "@/lib/google-oauth";
import { prisma } from "@/lib/prisma";
import { safeNext } from "@/lib/safe-next";

type IdTokenClaims = { iss?: string; aud?: string; exp?: number; email?: string; email_verified?: boolean };

/** The email Google vouches for, or null. The id_token comes straight from Google's token endpoint over TLS, so its claims are read without re-checking the signature. */
async function googleEmail(code: string, cfg: NonNullable<ReturnType<typeof googleConfig>>): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: cfg.redirectUri, grant_type: "authorization_code" }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const { id_token } = (await res.json()) as { id_token?: string };
  const payload = id_token?.split(".")[1];
  if (!payload) return null;
  const c = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as IdTokenClaims;
  const issOk = c.iss === "https://accounts.google.com" || c.iss === "accounts.google.com";
  if (!issOk || c.aud !== cfg.clientId || !c.exp || c.exp * 1000 < Date.now()) return null;
  if (c.email_verified !== true || typeof c.email !== "string") return null;
  return c.email.trim().toLowerCase();
}

// Step 2: Google sends the browser back here with ?code=&state=
export async function GET(request: NextRequest): Promise<never> {
  const cfg = googleConfig();
  if (!cfg) redirect("/login");

  const jar = await cookies();
  const [state, next] = (jar.get(GOOGLE_STATE_COOKIE)?.value ?? "").split(":");
  jar.delete(GOOGLE_STATE_COOKIE);
  const q = request.nextUrl.searchParams;
  const code = q.get("code");
  // Cancelled at Google, expired cookie or a forged callback
  if (!code || !state || q.get("state") !== state) redirect("/login?error=google");

  const email = await googleEmail(code, cfg).catch(() => null);
  if (!email) redirect("/login?error=google");

  // Only accounts an Admin already created may sign in; nobody is auto-registered
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) redirect("/login?error=google-unknown");
  if (!user.active) redirect("/login?error=locked");

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await startSession(user);
  redirect(safeNext(decodeURIComponent(next ?? "")));
}
