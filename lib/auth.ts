import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { google } from "googleapis";
import type { CodeChallengeMethod } from "google-auth-library";
import { getDb } from "./db";
import {
  appUrl, readCookie, SESSION_COOKIE, SESSION_SECONDS, signToken, verifyToken,
} from "./session-token";

export type Role = "tutor" | "director" | "tutee";
export type User = { id: number; email: string; name: string | null; picture: string | null; role: Role; onboarded: boolean; requestedRole: "tutor" | "director" | null };

/** The signed-in user for a route handler (reads the Cookie header), or null. */
export function getUserFromRequest(req: Request): User | null {
  return userFromToken(readCookie(req.headers.get("cookie"), SESSION_COOKIE));
}

/** The signed-in user for a server page or layout (reads cookies() from next/headers), or null. */
export async function getUser(): Promise<User | null> {
  return userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
}

function userFromToken(token: string | undefined): User | null {
  const payload = verifyToken<{ uid: number; sv?: number }>(token);
  if (!payload || !Number.isInteger(payload.uid)) return null;
  // Checked on every request: deactivating a tutor in allowed_users ends their access at once.
  const row = userRow("u.id = ?", payload.uid);
  // Signing out bumps session_version, so every cookie issued before that stops working (tokens without sv count as 0).
  if (!row || (payload.sv ?? 0) !== row.sv) return null;
  return toUser(row);
}

/** Ends every session of this user on the server (sign-out). */
export function endSessions(userId: number) {
  getDb().prepare("UPDATE users SET session_version = session_version + 1 WHERE id = ?").run(userId);
}

/** The user a (still valid) cookie belongs to, for sign-out. */
export function userIdFromCookie(token: string | undefined): number | null {
  const payload = verifyToken<{ uid: number }>(token);
  return payload && Number.isInteger(payload.uid) ? payload.uid : null;
}

type UserRow = Omit<User, "onboarded"> & { onboarded: number; sv: number };
function toUser({ sv: _sv, onboarded, ...rest }: UserRow): User {
  return { ...rest, onboarded: !!onboarded };
}

function userWhere(where: string, param: string | number): User | null {
  const row = userRow(where, param);
  return row ? toUser(row) : null;
}

function userRow(where: string, param: string | number): UserRow | null {
  return (getDb().prepare(
    `SELECT u.id, u.email, COALESCE(NULLIF(trim(u.name), ''), NULLIF(trim(a.name), '')) AS name, u.picture, CASE WHEN a.active = 1 THEN a.role ELSE 'tutee' END AS role,
       (u.onboarded = 1 OR a.active = 1) AS onboarded, u.requested_role AS requestedRole, u.session_version AS sv
     FROM users u LEFT JOIN allowed_users a ON a.email = lower(u.email) WHERE ${where}`,
  ).get(param) as UserRow | undefined) ?? null;
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
  // Anyone else with a verified account (on the allowed domain) is a tutee: no tutor tools, just the student guide.
  let user = upsertUser(claims.sub, email, claims.name ?? null, claims.picture ?? null);
  // The director and anyone already on the active list skip the role chooser.
  if (row?.active && !user.onboarded) {
    db.prepare("UPDATE users SET onboarded = 1 WHERE id = ?").run(user.id);
    user = { ...user, onboarded: true };
  }
  // Rows saved before sign-in existed have no owner. The director takes them over, so they are not lost.
  if (row?.active && row.role === "director") {
    for (const table of ["sessions", "tasks", "quiz_results"]) db.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id IS NULL`).run(user.id);
  }
  return user;
}

export function sessionCookieValue(user: User): string {
  // The role is only a hint for the proxy (to keep tutees off tutor pages); every page and route re-reads the real role.
  const sv = (getDb().prepare("SELECT session_version AS sv FROM users WHERE id = ?").get(user.id) as { sv: number } | undefined)?.sv ?? 0;
  return signToken({ uid: user.id, role: user.role, sv }, SESSION_SECONDS);
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

