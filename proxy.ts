import { NextResponse, type NextRequest } from "next/server";
import { requireAuthSecret, SESSION_COOKIE, verifyToken } from "@/lib/session-token";

/**
 * First gate only: every page and API route except /login and /api/auth/* needs a valid session cookie.
 * Route handlers and pages check the user again themselves (lib/auth.ts).
 */
export function proxy(req: NextRequest) {
  requireAuthSecret();
  const { pathname, search } = req.nextUrl;
  const open = pathname === "/login" || pathname.startsWith("/api/auth/");
  if (!open && !verifyToken(req.cookies.get(SESSION_COOKIE)?.value)) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Everything except static files, images and the favicon.
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
