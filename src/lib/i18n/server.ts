import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { DEFAULT_LOCALE, DEFAULT_THEME, isLocale, isTheme, LOCALE_COOKIE, THEME_COOKIE, type Locale, type Messages, type Theme } from "./config";

export const getLocale = cache(async (): Promise<Locale> => {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
});

export const getTheme = cache(async (): Promise<Theme> => {
  const v = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(v) ? v : DEFAULT_THEME;
});

/** Messages of one namespace in the visitor's language */
export async function getT<Shape>(messages: Messages<Shape>): Promise<Shape> {
  return messages[await getLocale()];
}
