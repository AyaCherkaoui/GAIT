import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { google } from "googleapis";
import type { CodeChallengeMethod } from "google-auth-library";
import { getDb } from "./db";
import {
  appUrl, readCookie, SESSION_COOKIE, SESSION_SECONDS, signToken, verifyToken,
} from "./session-token";

export type User = { id: number; email: string; name: string | null; picture: string | null };

/** The signed-in user for a route handler (reads the Cookie header), or null. */
export function getUserFromRequest(req: Request): User | null {
  return userFromToken(readCookie(req.headers.get("cookie"), SESSION_COOKIE));
}

/** The signed-in user for a server page or layout (reads cookies() from next/headers), or null. */
export async function getUser(): Promise<User | null> {
  return userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
}

function userFromToken(token: string | undefined): User | null {
  const payload = verifyToken<{ uid: number }>(token);
  if (!payload || !Number.isInteger(payload.uid)) return null;
  const row = getDb().prepare("SELECT id, email, name, picture FROM users WHERE id = ?").get(payload.uid) as User | undefined;
  return row ?? null;
}

export function upsertUser(googleSub: string, email: string, name: string | null, picture: string | null): User {
  const db = getDb();
  db.prepare(
    `INSERT INTO users (google_sub, email, name, picture) VALUES (?, ?, ?, ?)
     ON CONFLICT(google_sub) DO UPDATE SET email = excluded.email, name = excluded.name, picture = excluded.picture, last_login = datetime('now')`,
  ).run(googleSub, email, name, picture);
  return db.prepare("SELECT id, email, name, picture FROM users WHERE google_sub = ?").get(googleSub) as User;
}

export class SignInRefused extends Error {}

/** Applies the sign-in policy to a verified Google ID-token payload and records the user. */
export function signInFromGoogle(claims: { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string }): User {
  const email = claims.email?.toLowerCase();
  if (!claims.sub || !email || claims.email_verified !== true) throw new SignInRefused("unverified");
  const allowed = process.env.ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase().replace(/^@/, "");
  if (allowed && email.split("@")[1] !== allowed) throw new SignInRefused("domain");
  return upsertUser(claims.sub, email, claims.name ?? null, claims.picture ?? null);
}

export function sessionCookieValue(user: User): string {
  return signToken({ uid: user.id }, SESSION_SECONDS);
}

function oauthClient() {
  const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret } = process.env;
  if (!id || !secret) throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set.");
  return new google.auth.OAuth2(id, secret, `${appUrl()}/api/auth/callback`);
}

/** Step 1: the Google URL to send the browser to, plus the signed cookie that holds state and the PKCE verifier. */
export async function startGoogleSignIn(next: string): Promise<{ url: string; oauthCookie: string }> {
  const client = oauthClient();
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
  const state = randomBytes(24).toString("base64url");
  const url = client.generateAuthUrl({
    scope: ["openid", "email", "profile"],
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256" as unknown as CodeChallengeMethod,
    prompt: "select_account",
  });
  return { url, oauthCookie: signToken({ state, verifier: codeVerifier, next }, 600) };
}

/** Step 2: trade the code for a verified ID token. */
export async function finishGoogleSignIn(code: string, verifier: string) {
  const client = oauthClient();
  const { tokens } = await client.getToken({ code, codeVerifier: verifier });
  if (!tokens.id_token) throw new SignInRefused("no_token");
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
  return signInFromGoogle(ticket.getPayload() ?? {});
}

