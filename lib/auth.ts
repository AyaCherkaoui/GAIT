import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { google } from "googleapis";
import type { CodeChallengeMethod } from "google-auth-library";
import { getDb } from "./db";
import {
  appUrl, readCookie, SESSION_COOKIE, SESSION_SECONDS, signToken, verifyToken,
} from "./session-token";

export type Role = "tutor" | "director";
export type User = { id: number; email: string; name: string | null; picture: string | null; role: Role };

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
  // Checked on every request: deactivating a tutor in allowed_users ends their access at once.
  return userWhere("u.id = ?", payload.uid);
}

function userWhere(where: string, param: string | number): User | null {
  const row = getDb().prepare(
    `SELECT u.id, u.email, u.name, u.picture, a.role FROM users u
     JOIN allowed_users a ON a.email = lower(u.email) AND a.active = 1 WHERE ${where}`,
  ).get(param) as User | undefined;
  return row ?? null;
}

/** DIRECTOR_EMAIL is always an active director, so the director can never be locked out. */
export function seedDirector() {
  const email = process.env.DIRECTOR_EMAIL?.trim().toLowerCase();
  if (!email) return;
  getDb().prepare(
    `INSERT INTO allowed_users (email, role, active) VALUES (?, 'director', 1)
     ON CONFLICT(email) DO UPDATE SET role = 'director', active = 1`,
  ).run(email);
}

export function upsertUser(googleSub: string, email: string, name: string | null, picture: string | null): User {
  const db = getDb();
  db.prepare(
    `INSERT INTO users (google_sub, email, name, picture) VALUES (?, ?, ?, ?)
     ON CONFLICT(google_sub) DO UPDATE SET email = excluded.email, name = excluded.name, picture = excluded.picture, last_login = datetime('now')`,
  ).run(googleSub, email, name, picture);
  return userWhere("u.google_sub = ?", googleSub)!;
}

export class SignInRefused extends Error {}

/** Applies the sign-in policy to a verified Google ID-token payload and records the user. */
export function signInFromGoogle(claims: { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string }): User {
  const email = claims.email?.toLowerCase();
  if (!claims.sub || !email || claims.email_verified !== true) throw new SignInRefused("unverified");
  const allowed = process.env.ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase().replace(/^@/, "");
  if (allowed && email.split("@")[1] !== allowed) throw new SignInRefused("domain");
  seedDirector();
  const db = getDb();
  const row = db.prepare("SELECT active, role FROM allowed_users WHERE email = ?").get(email) as { active: number; role: string } | undefined;
  if (!row?.active) throw new SignInRefused("not_allowed");
  const user = upsertUser(claims.sub, email, claims.name ?? null, claims.picture ?? null);
  // Rows saved before sign-in existed have no owner. The director takes them over, so they are not lost.
  if (row.role === "director") {
    for (const table of ["sessions", "tasks", "quiz_results", "course_policies", "debriefs", "usage_events"]) db.prepare(`UPDATE OR IGNORE ${table} SET user_id = ? WHERE user_id IS NULL`).run(user.id);
  }
  return user;
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

