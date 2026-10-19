import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE, verifySession } from "@/lib/session";

// The whole site needs a login (viewer or admin). Admin pages and admin APIs re-check the admin role themselves.
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  const url = new URL("/dang-nhap", request.url);
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!dang-nhap|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
