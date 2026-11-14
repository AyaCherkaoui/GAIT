import { NextResponse } from "next/server";
import { finishGoogleSignIn, sessionCookieValue, SignInRefused } from "@/lib/auth";
import {
  appUrl, OAUTH_COOKIE, readCookie, safeNext, secureCookies, SESSION_COOKIE, SESSION_SECONDS, verifyToken,
} from "@/lib/session-token";

export const dynamic = "force-dynamic";

function fail(code: string) {
  const res = NextResponse.redirect(`${appUrl()}/login?error=${code}`);
  res.cookies.set(OAUTH_COOKIE, "", { path: "/api/auth", maxAge: 0 });
  return res;
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const flow = verifyToken<{ state: string; verifier: string; next: string }>(readCookie(req.headers.get("cookie"), OAUTH_COOKIE));
  const code = params.get("code");
  if (params.get("error") || !code || !flow || params.get("state") !== flow.state) return fail("denied");
  try {
    const user = await finishGoogleSignIn(code, flow.verifier);
    const res = NextResponse.redirect(`${appUrl()}${safeNext(flow.next)}`);
    res.cookies.set(SESSION_COOKIE, sessionCookieValue(user), {
      httpOnly: true, sameSite: "lax", secure: secureCookies(), path: "/", maxAge: SESSION_SECONDS,
    });
    res.cookies.set(OAUTH_COOKIE, "", { path: "/api/auth", maxAge: 0 });
    return res;
  } catch (e) {
    if (e instanceof SignInRefused) return fail(e.message === "domain" || e.message === "not_allowed" ? e.message : "denied");
    console.error(e);
    return fail("failed");
  }
}
