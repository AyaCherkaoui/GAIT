import { NextResponse } from "next/server";
import { endSessions, userIdFromCookie } from "@/lib/auth";
import { appUrl, readCookie, SESSION_COOKIE } from "@/lib/session-token";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Bump the user's session version first, so a copied cookie stops working on the server too.
  const uid = userIdFromCookie(readCookie(req.headers.get("cookie"), SESSION_COOKIE));
  if (uid !== null) endSessions(uid);
  const res = NextResponse.redirect(`${appUrl()}/login`, 303);
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
