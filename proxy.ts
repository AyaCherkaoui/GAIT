import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuthSecret, SESSION_COOKIE, verifyToken } from "@/lib/session-token";

const dev = process.env.NODE_ENV !== "production";
const CSP = [
  "default-src 'self'",
  // Next.js inlines small scripts and styles; dev tooling also needs eval and websockets.
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  `connect-src 'self'${dev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

function secure(res: NextResponse) {
  res.headers.set("Content-Security-Policy", CSP);
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (!dev) res.headers.set("Strict-Transport-Security", "max-age=31536000");
  return res;
}

/**
 * First gate only (and security headers on every response): every page and API route except /login and /api/auth/* needs a valid session cookie.
 * Route handlers and pages check the user again themselves (lib/auth.ts).
 */
export function proxy(req: NextRequest) {
  requireAuthSecret();
  const { pathname, search } = req.nextUrl;
  const open = pathname === "/login" || pathname.startsWith("/api/auth/");
  let token = verifyToken<{ role?: string; uid?: number; sv?: number }>(req.cookies.get(SESSION_COOKIE)?.value);
  // A cookie from before the user signed out is no longer valid (the version in users moves on at sign-out).
  if (token) {
    const row = getDb().prepare("SELECT session_version AS sv FROM users WHERE id = ?").get(token.uid ?? -1) as { sv: number } | undefined;
    if (!row || row.sv !== (token.sv ?? 0)) token = null;
  }
  if (!open && !token) {
    if (pathname.startsWith("/api/")) return secure(NextResponse.json({ error: "Please sign in to continue." }, { status: 401 }));
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    return secure(NextResponse.redirect(url));
  }
  // Tutees get the home page and the role chooser only; every API route also refuses them (lib/api.ts).
  if (!open && token?.role === "tutee" && pathname !== "/" && pathname !== "/welcome" && pathname !== "/coach" && !pathname.startsWith("/api/")) return secure(NextResponse.redirect(new URL("/", req.url)));
  return secure(NextResponse.next());
}

// Everything except static files, images and the favicon.
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
