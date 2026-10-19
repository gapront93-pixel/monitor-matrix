import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { can, type Permission, type Role } from "./permissions";
import { prisma } from "./prisma";
import { SESSION_COOKIE, SESSION_TTL, signSession, verifySession } from "./session";

export type CurrentUser = { id: number; email: string; name: string; role: Role };

/**
 * The signed-in user, re-read from the database once per request: a locked account, a role change
 * or a password reset (sessionVersion bump) ends old sessions at once.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const s = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s) return null;
  const u = await prisma.user.findUnique({ where: { id: s.uid }, select: { id: true, email: true, name: true, role: true, active: true, sessionVersion: true } });
  if (!u || !u.active || u.sessionVersion !== s.v) return null;
  return { id: u.id, email: u.email, name: u.name, role: u.role };
});

/** Pages: send anonymous visitors to the login page */
export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/dang-nhap");
  return u;
}

/** Server actions and API routes: the user if they hold `perm`, else null */
export async function userWith(perm: Permission): Promise<CurrentUser | null> {
  const u = await getCurrentUser();
  return u && can(u.role, perm) ? u : null;
}

export async function startSession(u: { id: number; role: Role; sessionVersion: number }): Promise<void> {
  const ttl = SESSION_TTL[u.role];
  const exp = Math.floor(Date.now() / 1000) + ttl;
  (await cookies()).set(SESSION_COOKIE, await signSession({ uid: u.id, v: u.sessionVersion, role: u.role, exp }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIE !== "1",
    path: "/",
    maxAge: ttl,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

// --- Login throttle: one PM2 instance, so memory is enough ---
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 8;
const fails = new Map<string, { n: number; until: number }>();

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("cf-connecting-ip") ?? h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export function loginBlocked(key: string): boolean {
  const f = fails.get(key);
  return !!f && f.n >= MAX_FAILS && f.until > Date.now();
}

export function noteLoginFailure(key: string): void {
  const f = fails.get(key);
  const now = Date.now();
  fails.set(key, f && f.until > now ? { n: f.n + 1, until: f.until } : { n: 1, until: now + WINDOW_MS });
}

export function clearLoginFailures(key: string): void {
  fails.delete(key);
}
