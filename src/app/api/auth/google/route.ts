import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { GOOGLE_STATE_COOKIE, GOOGLE_STATE_PATH, googleConfig } from "@/lib/google-oauth";
import { safeNext } from "@/lib/safe-next";

// Step 1: send the browser to Google's account picker
export async function GET(request: NextRequest): Promise<never> {
  const cfg = googleConfig();
  if (!cfg) redirect("/login");

  const state = crypto.randomUUID();
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  (await cookies()).set(GOOGLE_STATE_COOKIE, `${state}:${encodeURIComponent(next)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIE !== "1",
    path: GOOGLE_STATE_PATH,
    maxAge: 10 * 60,
  });

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: "openid email",
    state,
    prompt: "select_account",
  }).toString();
  redirect(url.toString());
}
