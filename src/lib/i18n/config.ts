// Shared by server and client: which languages exist and where the choices are kept

export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "vi";
export const LOCALE_COOKIE = "mm_locale";

export const LOCALE_NAMES: Record<Locale, string> = { vi: "Tiếng Việt", en: "English" };

export const THEMES = ["dark", "light", "system"] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = "dark";
export const THEME_COOKIE = "mm_theme";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

export function isTheme(v: unknown): v is Theme {
  return typeof v === "string" && (THEMES as readonly string[]).includes(v);
}

/** One namespace of messages, the same shape in every language. Values may be functions (counts, names). */
export type Messages<Shape> = Record<Locale, Shape>;
