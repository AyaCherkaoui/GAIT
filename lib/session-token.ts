import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "gait_session";
export const OAUTH_COOKIE = "gait_oauth";
export const SESSION_SECONDS = 7 * 24 * 3600;
export const OAUTH_SECONDS = 10 * 60;

/** AUTH_SECRET signs every cookie. Without it nothing works, so fail loudly. */
function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET is not set (use at least 32 random characters). See .env.example.");
  return s;
}

export function requireAuthSecret() {
  secret();
}

/** A signed, expiring token: base64url(JSON payload) + "." + HMAC-SHA256. */
export function signToken(payload: Record<string, unknown>, seconds: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + seconds })).toString("base64url");
  return `${body}.${createHmac("sha256", secret()).update(body).digest("base64url")}`;
}

export function verifyToken<T extends Record<string, unknown>>(token: string | undefined): (T & { exp: number }) | null {
  if (!token) return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const expected = createHmac("sha256", secret()).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp: number };
    return typeof payload.exp === "number" && payload.exp > Date.now() / 1000 ? payload : null;
  } catch {
    return null;
  }
}

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3100").replace(/\/+$/, "");
}

/** Cookies are Secure whenever the app is served over https. */
export const secureCookies = () => appUrl().startsWith("https:");

/** Only same-origin paths may be used as a post-login destination. */
export function safeNext(value: unknown): string {
  if (typeof value !== "string" || value.length > 300) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return "/";
  return value;
}

export function readCookie(header: string | null, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}
