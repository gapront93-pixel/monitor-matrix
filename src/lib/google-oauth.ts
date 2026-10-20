import "server-only";

// Google sign-in is optional: it only turns on when GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and APP_URL are set
// in the server .env. Read at request time, never at build, so a pm2 restart is enough.
export function googleConfig(): { clientId: string; clientSecret: string; redirectUri: string } | null {
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret, APP_URL: appUrl } = process.env;
  if (!clientId || !clientSecret || !appUrl) return null;
  return { clientId, clientSecret, redirectUri: new URL("/api/auth/google/callback", appUrl).toString() };
}

/** state (CSRF check) + the page to return to, kept for the trip to Google and back */
export const GOOGLE_STATE_COOKIE = "mm_google_state";
export const GOOGLE_STATE_PATH = "/api/auth/google";
