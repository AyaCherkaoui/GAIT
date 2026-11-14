import { NextResponse } from "next/server";
import { startGoogleSignIn } from "@/lib/auth";
import { OAUTH_COOKIE, OAUTH_SECONDS, safeNext, secureCookies } from "@/lib/session-token";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const next = safeNext(new URL(req.url).searchParams.get("next"));
    const { url, oauthCookie } = await startGoogleSignIn(next);
    const res = NextResponse.redirect(url);
    res.cookies.set(OAUTH_COOKIE, oauthCookie, {
      httpOnly: true, sameSite: "lax", secure: secureCookies(), path: "/api/auth", maxAge: OAUTH_SECONDS,
    });
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(new URL("/login?error=config", process.env.APP_URL || req.url));
  }
}
