import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE, verifySession } from "@/lib/session";

// The whole site needs a login (viewer or admin); public fonts are not secret and load without one. Admin pages and admin APIs re-check the admin role themselves.
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL("/dang-nhap", request.url);
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!dang-nhap|_next/static|_next/image|fonts/|favicon.ico|icon.png|apple-icon.png|robots.txt).*)"],
};
