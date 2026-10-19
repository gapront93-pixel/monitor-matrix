import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { cookies, headers } from "next/headers";

import { SESSION_COOKIE, SESSION_TTL, signSession, verifySession, type Role, type Session } from "./session";

export async function getSession(): Promise<Session | null> {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function isAdmin(): Promise<boolean> {
  return (await getSession())?.role === "admin";
}

/** Compares digests so neither the length nor the content leaks through timing */
export function sameSecret(given: string, expected: string | undefined): boolean {
  if (!expected) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function startSession(role: Role, email?: string): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL[role];
  (await cookies()).set(SESSION_COOKIE, await signSession({ role, email, exp }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIE !== "1",
    path: "/",
    maxAge: SESSION_TTL[role],
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

export function loginBlocked(ip: string): boolean {
  const f = fails.get(ip);
  return !!f && f.n >= MAX_FAILS && f.until > Date.now();
}

export function noteLoginFailure(ip: string): void {
  const f = fails.get(ip);
  const now = Date.now();
  fails.set(ip, f && f.until > now ? { n: f.n + 1, until: f.until } : { n: 1, until: now + WINDOW_MS });
}

export function clearLoginFailures(ip: string): void {
  fails.delete(ip);
}
