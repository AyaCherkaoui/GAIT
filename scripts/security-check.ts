/**
 * Probes sign-in, access control, headers, size limits and rate limits against a private server.
 * Usage: npm run security-check
 * It starts `next dev` on port 3101 with a throwaway database and fake AI settings (no AI calls are made),
 * then stops it. Set GAIT_DEV_ARGS (for example "--webpack") to pass extra flags to next dev.
 * The real Google round trip needs a browser and cannot be tested here; the callback is tested by
 * feeding signInFromGoogle() a stand-in ID-token payload.
 */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = 3101;
const BASE = `http://localhost:${PORT}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gait-security-"));
const SECRET = randomBytes(32).toString("base64url");

Object.assign(process.env, {
  GAIT_DB: path.join(dir, "test.db"),
  AUTH_SECRET: SECRET,
  APP_URL: BASE,
  ALLOWED_EMAIL_DOMAIN: "augustana.edu",
  GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "test-secret",
  // Real provider calls are impossible: the AI service points at a closed port.
  GAIT_PROVIDER: "anthropic",
  ANTHROPIC_API_KEY: "test",
  ANTHROPIC_BASE_URL: "http://127.0.0.1:9",
});

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  ${detail}`}`);
  if (!ok) failures++;
}

const call = (p: string, init: RequestInit = {}, cookie?: string) =>
  fetch(BASE + p, { redirect: "manual", ...init, headers: { ...(init.headers as object), ...(cookie ? { cookie: `gait_session=${cookie}` } : {}) } });
const post = (p: string, body: unknown, cookie?: string) =>
  call(p, { method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }, cookie);

async function waitForServer() {
  for (let i = 0; i < 90; i++) {
    try {
      if ((await fetch(`${BASE}/login`, { redirect: "manual" })).status === 200) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("The test server did not start. See " + path.join(dir, "server.log"));
}

async function main() {
  const { getDb } = await import("../lib/db");
  const { signInFromGoogle, sessionCookieValue, SignInRefused } = await import("../lib/auth");
  const { signToken } = await import("../lib/session-token");

  const log = fs.openSync(path.join(dir, "server.log"), "w");
  const server = spawn("npx", ["next", "dev", "-p", String(PORT), ...(process.env.GAIT_DEV_ARGS?.split(" ").filter(Boolean) ?? [])], {
    stdio: ["ignore", log, log], detached: true, env: process.env,
  });
  const stop = () => {
    try {
      process.kill(-server.pid!); // only the process group started here
    } catch {
      /* already gone */
    }
  };
  try {
    await waitForServer();

    // 1. Signed-out access
    for (const p of ["/", "/history", "/session/1/print", "/search", "/practice"]) {
      const r = await call(p);
      const loc = r.headers.get("location") ?? "";
      check(`signed out: ${p} redirects to /login`, [302, 303, 307, 308].includes(r.status) && loc.includes("/login?next="), `${r.status} ${loc}`);
    }
    for (const p of ["/api/session", "/api/session/1", "/api/taskforce", "/api/practice/results", "/api/search", "/api/feed"]) {
      check(`signed out: GET ${p} is 401`, (await call(p)).status === 401);
    }
    for (const p of ["/api/session", "/api/taskforce", "/api/practice", "/api/search", "/api/session/1/help"]) {
      check(`signed out: POST ${p} is 401`, (await post(p, {})).status === 401);
    }

    // 2. Login page and Google redirect
    const login = await call("/login");
    check("/login has a Sign in with Google button", login.status === 200 && (await login.text()).includes("Sign in with Google"));
    const start = await call("/api/auth/google?next=/history");
    const to = new URL(start.headers.get("location") ?? "http://none");
    check("/api/auth/google redirects to accounts.google.com", to.host === "accounts.google.com", to.href);
    check("redirect carries state", (to.searchParams.get("state") ?? "").length >= 16);
    check("redirect carries PKCE (S256 challenge)", !!to.searchParams.get("code_challenge") && to.searchParams.get("code_challenge_method") === "S256");
    check("redirect uses the callback URL", to.searchParams.get("redirect_uri") === `${BASE}/api/auth/callback`);
    const oc = start.headers.get("set-cookie") ?? "";
    check("flow cookie is httpOnly, SameSite=Lax, short-lived", /gait_oauth=/.test(oc) && /httponly/i.test(oc) && /samesite=lax/i.test(oc) && /max-age=600/i.test(oc), oc);
    const evil = await call("/api/auth/google?next=//evil.example");
    const evilCookie = (evil.headers.get("set-cookie") ?? "").split(";")[0].split("=")[1];
    const evilNext = JSON.parse(Buffer.from(evilCookie.split(".")[0], "base64url").toString()).next;
    check("open redirect next is replaced by /", evilNext === "/", String(evilNext));

    // 3. Callback without or with a wrong state
    let r = await call("/api/auth/callback?code=x&state=y");
    check("callback without flow cookie is refused", (r.headers.get("location") ?? "").includes("/login?error=denied"));
    const flow = signToken({ state: "right", verifier: "v", next: "/" }, 600);
    r = await call("/api/auth/callback?code=x&state=wrong", { headers: { cookie: `gait_oauth=${flow}` } });
    check("callback with a wrong state is refused", (r.headers.get("location") ?? "").includes("/login?error=denied"));

    // 4. Forged cookies
    for (const [label, cookie] of [
      ["garbage", "abc"],
      ["wrong signature", signToken({ uid: 1 }, 60).replace(/\.[^.]+$/, ".AAAA")],
      ["unsigned payload", Buffer.from(JSON.stringify({ uid: 1, exp: 9999999999 })).toString("base64url") + "."],
      ["expired", signToken({ uid: 1 }, -10)],
    ] as const) {
      const a = await call("/api/session", {}, cookie);
      const b = await call("/history", {}, cookie);
      check(`forged cookie (${label}) is rejected`, a.status === 401 && b.status !== 200, `${a.status}/${b.status}`);
    }
    const ghost = sessionCookieValue({ id: 9999, email: "x@augustana.edu", name: null, picture: null, role: "tutor" });
    check("valid signature for a user that does not exist is rejected", (await call("/api/session", {}, ghost)).status === 401);

    // 5. Stubbed sign-in: upsert and policy
    const allow = getDb().prepare("INSERT INTO allowed_users (email, name, role) VALUES (?, ?, ?)");
    allow.run("alice@augustana.edu", "Alice", "tutor");
    allow.run("bob@augustana.edu", "Bob", "tutor");
    allow.run("carol@augustana.edu", "Carol", "director");
    const a = signInFromGoogle({ sub: "g-1", email: "Alice@Augustana.edu", email_verified: true, name: "Alice", picture: "https://x/p.png" });
    const a2 = signInFromGoogle({ sub: "g-1", email: "alice@augustana.edu", email_verified: true, name: "Alice B" });
    const rows = getDb().prepare("SELECT id, email, name FROM users WHERE google_sub = 'g-1'").all() as { id: number; email: string; name: string }[];
    check("stubbed callback upserts one users row", rows.length === 1 && a.id === a2.id && rows[0].name === "Alice B" && rows[0].email === "alice@augustana.edu", JSON.stringify(rows));
    for (const [label, claims, code] of [
      ["other email domain", { sub: "g-2", email: "x@gmail.com", email_verified: true }, "domain"],
      ["lookalike domain", { sub: "g-3", email: "x@augustana.edu.evil.com", email_verified: true }, "domain"],
      ["unverified email", { sub: "g-4", email: "x@augustana.edu", email_verified: false }, "unverified"],
    ] as const) {
      let got = "";
      try {
        signInFromGoogle(claims);
      } catch (e) {
        got = e instanceof SignInRefused ? e.message : "other";
      }
      check(`rejected sign-in: ${label}`, got === code, got);
    }
    check("rejected accounts are not stored", (getDb().prepare("SELECT COUNT(*) AS n FROM users WHERE google_sub IN ('g-2','g-3','g-4')").get() as { n: number }).n === 0);

    // 6. Signed in: own data only
    const alice = sessionCookieValue(a);
    const bob = signInFromGoogle({ sub: "g-5", email: "bob@augustana.edu", email_verified: true, name: "Bob" });
    const bobC = sessionCookieValue(bob);
    const db = getDb();
    const ins = db.prepare("INSERT INTO sessions (student_name, course, notes, outputs, user_id) VALUES (?, ?, ?, ?, ?)");
    const notes = JSON.stringify({ workedOn: "a", struggles: "b", wentWell: "c" });
    const outputs = JSON.stringify({ email: "", nextSteps: [], focusAreas: [], aiPrompts: [], dontAskAi: [] });
    const sid = Number(ins.run("S", "C", notes, outputs, a.id).lastInsertRowid);
    const orphan = Number(ins.run("Old", "C", notes, outputs, null).lastInsertRowid);
    check("signed in: GET /api/session is 200", (await call("/api/session", {}, alice)).status === 200);
    check("owner reads own session", (await call(`/api/session/${sid}`, {}, alice)).status === 200);
    check("another user cannot read it", (await call(`/api/session/${sid}`, {}, bobC)).status === 404);
    check("another user cannot print it", (await call(`/session/${sid}/print`, {}, bobC)).status === 404);
    check("owner can print it", (await call(`/session/${sid}/print`, {}, alice)).status === 200);
    const put = (c: string) => call(`/api/session/${sid}/reflection`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ learned: "x" }) }, c);
    check("another user cannot write a reflection", (await put(bobC)).status === 404);
    check("owner can write a reflection", (await put(alice)).status === 200);
    check("another user does not see it in their list", !(await (await call("/api/session", {}, bobC)).text()).includes('"S"'));
    check("rows with no owner are hidden", (await call(`/api/session/${orphan}`, {}, alice)).status === 404);

    // 6b. Tutor allowlist
    let refused = "";
    try {
      signInFromGoogle({ sub: "g-7", email: "dave@augustana.edu", email_verified: true });
    } catch (e) {
      refused = e instanceof SignInRefused ? e.message : "other";
    }
    check("sign-in for an email not on the list is refused with not_allowed", refused === "not_allowed", refused);
    check("an email not on the list gets no users row", (db.prepare("SELECT COUNT(*) AS n FROM users WHERE google_sub = 'g-7'").get() as { n: number }).n === 0);
    db.prepare("INSERT INTO allowed_users (email, role) VALUES ('erin@augustana.edu', 'tutor')").run();
    const erinC = sessionCookieValue(signInFromGoogle({ sub: "g-8", email: "erin@augustana.edu", email_verified: true }));
    check("a listed tutor is accepted", (await call("/api/session", {}, erinC)).status === 200);
    db.prepare("UPDATE allowed_users SET active = 0 WHERE email = 'erin@augustana.edu'").run();
    check("a deactivated tutor gets 401 on the next request", (await call("/api/session", {}, erinC)).status === 401);
    let refusedAgain = "";
    try {
      signInFromGoogle({ sub: "g-8", email: "erin@augustana.edu", email_verified: true });
    } catch (e) {
      refusedAgain = e instanceof SignInRefused ? e.message : "other";
    }
    check("a deactivated tutor cannot sign in again", refusedAgain === "not_allowed", refusedAgain);
    const carolUser = signInFromGoogle({ sub: "g-6", email: "carol@augustana.edu", email_verified: true, name: "Carol" });
    const carolC = sessionCookieValue(carolUser);
    check("a tutor gets 403 from GET /api/admin/tutors", (await call("/api/admin/tutors", {}, alice)).status === 403);
    check("a tutor gets 403 from POST /api/admin/tutors", (await post("/api/admin/tutors", { email: "z@augustana.edu", role: "tutor" }, alice)).status === 403);
    check("a tutor gets 403 from DELETE /api/admin/tutors", (await call("/api/admin/tutors?email=bob@augustana.edu", { method: "DELETE" }, alice)).status === 403);
    check("signed out: GET /api/admin/tutors is 401", (await call("/api/admin/tutors")).status === 401);
    r = await call("/api/admin/tutors", {}, carolC);
    check("a director gets 200 from GET /api/admin/tutors", r.status === 200 && (await r.text()).includes("bob@augustana.edu"));
    check("a director can add a tutor", (await post("/api/admin/tutors", { email: " Frank@Augustana.edu ", name: "Frank", role: "tutor" }, carolC)).status === 200);
    check("the added email is stored lower-cased and active", (db.prepare("SELECT COUNT(*) AS n FROM allowed_users WHERE email = 'frank@augustana.edu' AND active = 1").get() as { n: number }).n === 1);
    check("an invalid email is 400", (await post("/api/admin/tutors", { email: "not-an-email", role: "tutor" }, carolC)).status === 400);
    check("an email over 254 characters is 400", (await post("/api/admin/tutors", { email: "a".repeat(250) + "@b.co", role: "tutor" }, carolC)).status === 400);
    check("a name over 100 characters is 400", (await post("/api/admin/tutors", { email: "g@augustana.edu", name: "n".repeat(101), role: "tutor" }, carolC)).status === 400);
    check("an unknown role is 400", (await post("/api/admin/tutors", { email: "g@augustana.edu", role: "boss" }, carolC)).status === 400);
    check("a director cannot deactivate themselves (400)", (await call("/api/admin/tutors?email=carol@augustana.edu", { method: "DELETE" }, carolC)).status === 400);
    check("a director cannot demote their own role (400)", (await post("/api/admin/tutors", { email: "carol@augustana.edu", role: "tutor" }, carolC)).status === 400);
    check("the director row is unchanged", (db.prepare("SELECT role, active FROM allowed_users WHERE email = 'carol@augustana.edu'").get() as { role: string; active: number }).role === "director");
    check("a director can deactivate another tutor", (await call("/api/admin/tutors?email=frank@augustana.edu", { method: "DELETE" }, carolC)).status === 200);
    check("the deactivated row is kept with active = 0", (db.prepare("SELECT active FROM allowed_users WHERE email = 'frank@augustana.edu'").get() as { active: number }).active === 0);
    r = await call("/admin/tutors", {}, alice);
    check("a tutor opening /admin/tutors is redirected to /", [302, 303, 307, 308].includes(r.status) && (r.headers.get("location") ?? "").replace(BASE, "") === "/", `${r.status} ${r.headers.get("location")}`);
    check("a director can open /admin/tutors", (await call("/admin/tutors", {}, carolC)).status === 200);
    check("the Admin link is shown to a director", (await (await call("/history", {}, carolC)).text()).includes('href="/admin/tutors"'));
    check("the Admin link is not shown to a tutor", !(await (await call("/history", {}, alice)).text()).includes('href="/admin/tutors"'));

    // 7. Headers
    const h = (await call("/login")).headers;
    check("CSP header (frame-ancestors none)", (h.get("content-security-policy") ?? "").includes("frame-ancestors 'none'"));
    check("X-Frame-Options DENY", h.get("x-frame-options") === "DENY");
    check("X-Content-Type-Options nosniff", h.get("x-content-type-options") === "nosniff");
    check("Referrer-Policy", h.get("referrer-policy") === "strict-origin-when-cross-origin");
    check("headers also on 401 API replies", (await call("/api/session")).headers.get("x-frame-options") === "DENY");

    // 8. Input limits
    r = await post("/api/search", { q: "a".repeat(200_000) }, alice);
    check("oversized body is 413", r.status === 413, String(r.status));
    r = await post("/api/search", "{bad", alice);
    check("invalid JSON is 400", r.status === 400, String(r.status));
    check("invalid JSON reply has no internal text", !/position|Unexpected|JSON\.parse/.test(await r.text()));
    check("wrong field type is 400", (await post("/api/search", { q: 123 }, alice)).status === 400);
    check("long field is 400", (await post("/api/search", { q: "a".repeat(600) }, alice)).status === 400);
    check("practice: bad turns is 400", (await post("/api/practice", { action: "roleplay", scenario: "x", turns: "zzz" }, alice)).status === 400);
    check("practice: unknown action is 400", (await post("/api/practice", { action: "nope" }, alice)).status === 400);
    check("taskforce: wrong type is 400", (await post("/api/taskforce", { title: 123 }, alice)).status === 400);

    // 9. No internal text in server errors (the AI service is unreachable, so the handler fails)
    r = await post("/api/taskforce", { title: "t" }, alice);
    const body = await r.text();
    check("unexpected failure is a plain 500 message", r.status === 500 && body.includes("Something went wrong") && !/ECONN|127\.0\.0\.1|fetch|node_modules|\bat \w|Error:/.test(body), `${r.status} ${body}`);

    // 10. Rate limit (empty questions fail validation before any AI call)
    const carol = carolC;
    const codes: number[] = [];
    for (let i = 0; i < 25; i++) codes.push((await post("/api/search", { q: "" }, carol)).status);
    check("rate limit returns 429 after 20 requests", codes.slice(0, 20).every((c) => c === 400) && codes.slice(20).every((c) => c === 429), codes.join(","));
    check("rate limit is per user", (await post("/api/search", { q: "" }, bobC)).status === 400);

    // 11. Logout
    r = await call("/api/auth/logout", { method: "POST" });
    check("logout clears the cookie and goes to /login", /gait_session=;/.test(r.headers.get("set-cookie") ?? "") && (r.headers.get("location") ?? "").endsWith("/login"));
  } finally {
    stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
