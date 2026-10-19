"use server";

import { cookies } from "next/headers";

import { isLocale, isTheme, LOCALE_COOKIE, THEME_COOKIE } from "./config";

const YEAR = 365 * 24 * 3600;

export async function setLocale(v: string): Promise<void> {
  if (isLocale(v)) (await cookies()).set(LOCALE_COOKIE, v, { path: "/", maxAge: YEAR, sameSite: "lax" });
}

export async function setTheme(v: string): Promise<void> {
  if (isTheme(v)) (await cookies()).set(THEME_COOKIE, v, { path: "/", maxAge: YEAR, sameSite: "lax" });
}
