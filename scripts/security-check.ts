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
import http from "node:http";
import os from "node:os";
import path from "node:path";

const PORT = Number(process.env.CHECK_PORT) || 3101; // CHECK_PORT lets several checkouts run checks at once
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
    stdio: ["ignore", log, log], detached: true, env: { ...process.env, GAIT_DIST_DIR: ".next-security", GAIT_TEST_TOOLS: "0" },
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
    check("signed out: PUT /api/taskforce is 401", (await call("/api/taskforce", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: 1, done: [] }) })).status === 401);

    // 2. Login page and Google redirect
    const login = await call("/login");
    check("/login has a Continue with Google button", login.status === 200 && (await login.text()).includes("Continue with Google"));
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
    const ghost = sessionCookieValue({ id: 9999, email: "x@augustana.edu", name: null, picture: null, role: "tutor", onboarded: true, requestedRole: null });
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
    const planJson = JSON.stringify({ steps: ["a", "b"], done: [] });
    const taskId = Number(db.prepare("INSERT INTO tasks (title, description, plan, related, user_id) VALUES (?, ?, ?, ?, ?)").run("T", "d", planJson, "[]", a.id).lastInsertRowid);
    const putTask = (c: string, body: unknown) => call("/api/taskforce", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, c);
    check("taskforce: owner ticks a step", (await putTask(alice, { id: taskId, done: [0, 9, 0] })).status === 200 && (JSON.parse((db.prepare("SELECT plan FROM tasks WHERE id = ?").get(taskId) as { plan: string }).plan).done as number[]).join() === "0");
    check("taskforce: another user cannot tick it", (await putTask(bobC, { id: taskId, done: [1] })).status === 400);
    check("taskforce: bad body is 400", (await putTask(alice, { id: "x", done: "no" })).status === 400);
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
    const daveUser = refused === "" ? signInFromGoogle({ sub: "g-7", email: "dave@augustana.edu", email_verified: true }) : null;
    check("an email not on the list signs in as a tutee", daveUser?.role === "tutee", refused);
    const daveC = daveUser ? sessionCookieValue(daveUser) : "";
    check("a tutee gets 403 from GET /api/session", (await call("/api/session", {}, daveC)).status === 403);
    // Provider chip and the extra session fields
    check("signed out: GET /api/provider is 401", (await call("/api/provider")).status === 401);
    check("a tutee gets 403 from GET /api/provider", (await call("/api/provider", {}, daveC)).status === 403);
    const prov = await call("/api/provider", {}, alice);
    check("a tutor sees the provider and no key", prov.status === 200 && !/sk-|key"|api_key/i.test(await prov.text()));
    check("a tutee gets 403 from POST /api/session", (await post("/api/session", { notes: { workedOn: "x" } }, daveC)).status === 403);
    check("POST /api/session without notes is 400", (await post("/api/session", { notes: { aiPolicy: "banned", privateConcern: "x" } }, alice)).status === 400);
    check("a tutee is sent home from /history", (await call("/history", {}, daveC)).status !== 200);
    check("a new user is not onboarded", daveUser?.onboarded === false);
    r = await call("/", {}, daveC);
    check("a new user opening / is redirected to /welcome", [302, 303, 307, 308].includes(r.status) && (r.headers.get("location") ?? "").replace(BASE, "") === "/welcome", `${r.status} ${r.headers.get("location")}`);
    check("a new user can open /welcome", (await call("/welcome", {}, daveC)).status === 200);
    check("signed out: POST /api/me/role is 401", (await post("/api/me/role", { role: "student" })).status === 401);
    check("an unknown role is 400", (await post("/api/me/role", { role: "boss" }, daveC)).status === 400);
    check("choosing director is accepted as a request", (await post("/api/me/role", { role: "director" }, daveC)).status === 200);
    check("the requester is still a tutee", (db.prepare("SELECT COUNT(*) AS n FROM allowed_users WHERE email = 'dave@augustana.edu'").get() as { n: number }).n === 0);
    check("the requester gets 403 from /api/session", (await call("/api/session", {}, daveC)).status === 403);
    check("the requester gets 403 from /api/admin/tutors", (await call("/api/admin/tutors", {}, daveC)).status === 403);
    r = await call("/admin/tutors", {}, daveC);
    check("the requester opening /admin/tutors is redirected", [302, 303, 307, 308].includes(r.status), String(r.status));
    check("a second POST /api/me/role is 409", (await post("/api/me/role", { role: "tutor" }, daveC)).status === 409);
    check("a tutor cannot approve requests", (await post("/api/admin/requests", { id: daveUser?.id, action: "approve" }, alice)).status === 403);
    check("a requester cannot approve themselves", (await post("/api/admin/requests", { id: daveUser?.id, action: "approve" }, daveC)).status === 403);
    r = await call("/", {}, daveC);
    check("a requester sees the waiting banner on /", r.status === 200 && (await r.text()).includes("request is waiting for the director"));
    check("a tutee can open the home page after choosing", r.status === 200);
    const bobStill = signInFromGoogle({ sub: "g-5", email: "bob@augustana.edu", email_verified: true });
    check("a listed tutor is onboarded without the chooser", bobStill.onboarded === true);
    db.prepare("INSERT INTO allowed_users (email, role) VALUES ('erin@augustana.edu', 'tutor')").run();
    const erinC = sessionCookieValue(signInFromGoogle({ sub: "g-8", email: "erin@augustana.edu", email_verified: true }));
    check("a listed tutor is accepted", (await call("/api/session", {}, erinC)).status === 200);
    db.prepare("UPDATE allowed_users SET active = 0 WHERE email = 'erin@augustana.edu'").run();
    check("a deactivated tutor gets 403 on the next request", (await call("/api/session", {}, erinC)).status === 403);
    let refusedAgain = "";
    try {
      signInFromGoogle({ sub: "g-8", email: "erin@augustana.edu", email_verified: true });
    } catch (e) {
      refusedAgain = e instanceof SignInRefused ? e.message : "other";
    }
    check("a deactivated tutor signs in again only as a tutee", refusedAgain === "" , refusedAgain);
    const carolUser = signInFromGoogle({ sub: "g-6", email: "carol@augustana.edu", email_verified: true, name: "Carol" });
    const carolC = sessionCookieValue(carolUser);
    r = await call("/api/admin/tutors", {}, carolC);
    check("the director sees the request", r.status === 200 && (await r.text()).includes("dave@augustana.edu"));
    check("approving an unknown request is 404", (await post("/api/admin/requests", { id: 99999, action: "approve" }, carolC)).status === 404);
    check("the director can approve it", (await post("/api/admin/requests", { id: daveUser?.id, action: "approve" }, carolC)).status === 200);
    check("approval made the user a director", (await call("/api/session", {}, daveC)).status === 200 && (db.prepare("SELECT role, active FROM allowed_users WHERE email = 'dave@augustana.edu'").get() as { role: string; active: number }).role === "director");
    check("approval cleared the request", (db.prepare("SELECT requested_role AS r FROM users WHERE id = ?").get(daveUser?.id ?? 0) as { r: string | null }).r === null);
    const gina = signInFromGoogle({ sub: "g-9", email: "gina@augustana.edu", email_verified: true });
    const ginaC = sessionCookieValue(gina);
    await post("/api/me/role", { role: "tutor" }, ginaC);
    check("the director can decline a request", (await post("/api/admin/requests", { id: gina.id, action: "decline" }, carolC)).status === 200);
    check("decline clears it and grants nothing", (db.prepare("SELECT requested_role AS r FROM users WHERE id = ?").get(gina.id) as { r: string | null }).r === null && (await call("/api/session", {}, ginaC)).status === 403);
    const hank = signInFromGoogle({ sub: "g-10", email: "hank@augustana.edu", email_verified: true });
    check("choosing student sets onboarded with no request", (await post("/api/me/role", { role: "student" }, sessionCookieValue(hank))).status === 200 && (db.prepare("SELECT onboarded AS o, requested_role AS r FROM users WHERE id = ?").get(hank.id) as { o: number; r: string | null }).o === 1);
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
    // Course AI policies and AI talk
    check("signed out: GET /api/policies is 401", (await call("/api/policies")).status === 401);
    check("signed out: POST /api/policies is 401", (await post("/api/policies", {})).status === 401);
    check("signed out: POST /api/ai-talk is 401", (await post("/api/ai-talk", {})).status === 401);
    check("a tutee gets 403 from /api/policies", (await call("/api/policies", {}, ginaC)).status === 403 && (await post("/api/policies", { courseCode: "ENGL 101" }, ginaC)).status === 403);
    check("a tutee gets 403 from /api/ai-talk", (await post("/api/ai-talk", { action: "ownership", text: "x" }, ginaC)).status === 403);
    check("policies: missing course code is 400", (await post("/api/policies", {}, alice)).status === 400);
    check("policies: wrong type is 400", (await post("/api/policies", { courseCode: 5 }, alice)).status === 400);
    check("ai-talk: unknown action is 400", (await post("/api/ai-talk", { action: "nope" }, alice)).status === 400);
    check("ai-talk: empty paragraph is 400", (await post("/api/ai-talk", { action: "ownership", text: "" }, alice)).status === 400);
    check("ai-talk: unknown situation is 400", (await post("/api/ai-talk", { action: "tailor", scenario: "zzz" }, alice)).status === 400);
    check("a tutor saves a policy", (await post("/api/policies", { courseCode: "engl  101", policy: "limited" }, alice)).status === 200);
    check("another tutor does not see it", !(await (await call("/api/policies?q=", {}, bobC)).text()).includes("ENGL 101"));

    // News (#18)
    {
      allow.run("newsy@augustana.edu", "Newsy", "tutor");
      const newsTutor = sessionCookieValue(signInFromGoogle({ sub: "g-news", email: "newsy@augustana.edu", email_verified: true, name: "Newsy" }));
      check("signed out: GET /api/news is 401", (await call("/api/news")).status === 401);
      check("signed out: POST /api/news/try is 401", (await post("/api/news/try", {})).status === 401);
      check("a tutee gets 403 from /api/news", (await call("/api/news", {}, ginaC)).status === 403);
      check("a tutee gets 403 from /api/news/try", (await post("/api/news/try", { title: "x" }, ginaC)).status === 403);
      check("news/try: wrong type is 400", (await post("/api/news/try", { title: 5 }, alice)).status === 400);
      check("news/try: missing title is 400", (await post("/api/news/try", {}, alice)).status === 400);
      check("news/try: not JSON is 400", (await post("/api/news/try", "nope", alice)).status === 400);
      check("news/try: too much text is 413", (await post("/api/news/try", { title: "x", summary: "y".repeat(20_000) }, alice)).status === 413);
      r = await call("/api/news", {}, alice);
      const nj = (await r.json().catch(() => null)) as { items?: unknown[]; failed?: unknown[] } | null;
      check("a tutor gets the news list (items and failed sources, even with no internet)", r.status === 200 && Array.isArray(nj?.items) && Array.isArray(nj?.failed));
      check("the director gets the news list", (await call("/api/news", {}, carolC)).status === 200);
      const tryCodes: number[] = [];
      for (let i = 0; i < 25; i++) tryCodes.push((await post("/api/news/try", { title: "" }, newsTutor)).status);
      check("news/try is rate limited (429 after 20)", tryCodes.slice(0, 20).every((c) => c === 400) && tryCodes.slice(20).every((c) => c === 429), tryCodes.join(","));
    }

    // Debrief, impact, voice, director note
    const tuteeU = signInFromGoogle({ sub: "g-901", email: "tutee901@augustana.edu", email_verified: true });
    const tuteeC = sessionCookieValue(tuteeU);
    const putNote = (c: string, body: unknown, id = sid) => call(`/api/session/${id}/director-note`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, c);
    check("signed out: GET /api/debrief is 401", (await call("/api/debrief")).status === 401);
    check("signed out: POST /api/debrief is 401", (await post("/api/debrief", { drain: 3 })).status === 401);
    check("signed out: GET /api/impact is 401", (await call("/api/impact")).status === 401);
    check("signed out: PUT director-note is 401", (await putNote("", { note: "x" })).status === 401);
    check("a tutee gets 403 from /api/debrief", (await call("/api/debrief", {}, tuteeC)).status === 403 && (await post("/api/debrief", { drain: 3 }, tuteeC)).status === 403);
    check("a tutee gets 403 from /api/impact", (await call("/api/impact", {}, tuteeC)).status === 403);
    check("a tutee gets 403 from director-note", (await putNote(tuteeC, { note: "x" })).status === 403);
    check("a tutor gets 403 from /api/impact", (await call("/api/impact", {}, alice)).status === 403);
    check("a tutor gets 403 writing a director note", (await putNote(alice, { note: "x" })).status === 403);
    check("debrief: rating 9 is 400", (await post("/api/debrief", { drain: 9 }, alice)).status === 400);
    check("debrief: no rating is 400", (await post("/api/debrief", {}, alice)).status === 400);
    check("debrief: wrong note type is 400", (await post("/api/debrief", { drain: 3, note: 5 }, alice)).status === 400);
    check("a tutor saves a debrief", (await post("/api/debrief", { drain: 4, note: "long shift" }, alice)).status === 200);
    check("debrief is private to its owner", !(await (await call("/api/debrief", {}, bobC)).text()).includes('"shifts":1'));
    check("the director cannot read a tutor's debrief", !(await (await call("/api/debrief", {}, carolC)).text()).includes('"shifts":1'));
    check("director note: wrong type is 400", (await putNote(carolC, { note: 5 })).status === 400);
    check("director note: unknown session is 404", (await putNote(carolC, { note: "x" }, 999999)).status === 404);
    check("the director writes a note", (await putNote(carolC, { note: "Nice work on this one." })).status === 200);
    check("the session's tutor reads the note", (await (await call(`/api/session/${sid}/director-note`, {}, alice)).text()).includes("Nice work on this one."));
    check("another tutor cannot read the note", (await call(`/api/session/${sid}/director-note`, {}, bobC)).status === 404);
    r = await call("/api/impact", {}, carolC);
    check("the director reads impact counts", r.status === 200 && (await r.text()).includes('"weeks"'));
    r = await call("/api/impact?format=csv", {}, carolC);
    check("the director downloads impact CSV", r.status === 200 && (r.headers.get("content-type") ?? "").includes("text/csv") && (await r.text()).startsWith("week,sessions"));

    // Coach route (#18)
    check("signed out: POST /api/coach is 401", (await post("/api/coach", {})).status === 401);
    check("coach: no messages is 400", (await post("/api/coach", {}, tuteeC)).status === 400);
    check("coach: last turn from the assistant is 400", (await post("/api/coach", { messages: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }] }, tuteeC)).status === 400);
    check("coach: unknown role is 400", (await post("/api/coach", { messages: [{ role: "system", content: "a" }] }, tuteeC)).status === 400);
    check("coach: 2001 characters is 400", (await post("/api/coach", { messages: [{ role: "user", content: "a".repeat(2001) }] }, tuteeC)).status === 400);
    check("coach: 13 turns is 400", (await post("/api/coach", { messages: Array.from({ length: 13 }, () => ({ role: "user", content: "a" })) }, tuteeC)).status === 400);
    check("coach: a body over 100 KB is 413", (await post("/api/coach", { messages: [{ role: "user", content: "a".repeat(120_000) }] }, tuteeC)).status === 413);
    {
      const coachCodes: number[] = [];
      for (let i = 0; i < 24; i++) coachCodes.push((await post("/api/coach", { messages: [] }, ginaC)).status);
      check("coach is rate limited (429 after 20)", coachCodes.slice(0, 20).every((c) => c === 400) && coachCodes.slice(20).every((c) => c === 429), coachCodes.join(","));
    }

    // Director read-only access to sessions (#18)
    const secretSid = Number(ins.run("Pat Jones", "HIST 1", JSON.stringify({ workedOn: "a", struggles: "b", wentWell: "c", privateConcern: "PRIVATE-CONCERN-MARKER" }), outputs, a.id).lastInsertRowid);
    check("a tutor gets 404 reading another tutor's session", (await call(`/api/session/${secretSid}`, {}, bobC)).status === 404);
    r = await call(`/api/session/${secretSid}`, {}, carolC);
    const dirBody = await r.text();
    check("the director reads any tutor's session, read-only", r.status === 200 && dirBody.includes('"readOnly":true') && dirBody.includes('"tutor"'), `${r.status}`);
    check("the director never gets the private concern", !dirBody.includes("PRIVATE-CONCERN-MARKER"));
    check("the director sees only the student's first name", dirBody.includes('"Pat"') && !dirBody.includes("Pat Jones"));
    check("a tutee gets 403 from /api/session/[id]", (await call(`/api/session/${secretSid}`, {}, tuteeC)).status === 403);
    check("the director cannot write the tutor's reflection (404)", (await call(`/api/session/${secretSid}/reflection`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ learned: "x" }) }, carolC)).status === 404);
    check("signed out: /api/admin/sessions is 401", (await call("/api/admin/sessions")).status === 401);
    check("a tutor gets 403 from /api/admin/sessions", (await call("/api/admin/sessions", {}, alice)).status === 403);
    check("a tutee gets 403 from /api/admin/sessions", (await call("/api/admin/sessions", {}, tuteeC)).status === 403);
    r = await call("/api/admin/sessions", {}, carolC);
    const listBody = await r.text();
    check("the director lists sessions with first names only", r.status === 200 && listBody.includes('"student":"Pat"') && !listBody.includes("Pat Jones") && !listBody.includes("PRIVATE-CONCERN-MARKER"), `${r.status}`);
    check("a tutor is sent away from /admin/sessions", [302, 303, 307, 308].includes((await call("/admin/sessions", {}, alice)).status));
    check("the director opens /admin/sessions", (await call("/admin/sessions", {}, carolC)).status === 200);

    // Tutees: owner only
    {
      const put = (p: string, body: unknown, c?: string) => call(p, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, c);
      check("signed out: GET /api/tutees is 401", (await call("/api/tutees")).status === 401);
      check("signed out: POST /api/tutees is 401", (await post("/api/tutees", { firstName: "Ana" })).status === 401);
      check("a tutee gets 403 from /api/tutees", (await call("/api/tutees", {}, tuteeC)).status === 403);
      check("tutees: missing name is 400", (await post("/api/tutees", {}, alice)).status === 400);
      check("tutees: name that is not text is 400", (await post("/api/tutees", { firstName: 5 }, alice)).status === 400);
      r = await post("/api/tutees", { firstName: "Ana Lopez" }, alice);
      const tid = (await r.json()).id as number;
      check("a tutor adds a tutee, first name only", r.status === 200 && Number.isInteger(tid));
      const again = await (await post("/api/tutees", { firstName: "ana" }, alice)).json();
      check("the same first name is the same tutee", again.id === tid);
      check("the owner reads the timeline", (await call(`/api/tutees/${tid}`, {}, alice)).status === 200);
      check("another tutor gets 404 on the tutee", (await call(`/api/tutees/${tid}`, {}, bobC)).status === 404);
      check("another tutor cannot rename the tutee (404)", (await put(`/api/tutees/${tid}`, { firstName: "X" }, bobC)).status === 404);
      check("the director cannot read a tutor's tutee (404)", (await call(`/api/tutees/${tid}`, {}, carolC)).status === 404);
      check("the director cannot rename a tutor's tutee (404)", (await put(`/api/tutees/${tid}`, { firstName: "X" }, carolC)).status === 404);
      check("the owner renames the tutee", (await put(`/api/tutees/${tid}`, { firstName: "Anna" }, alice)).status === 200);
      check("rename with a bad body is 400", (await put(`/api/tutees/${tid}`, { firstName: 7 }, alice)).status === 400);
      check("another tutor's list does not hold the tutee", !(await (await call("/api/tutees", {}, bobC)).text()).includes("Anna"));
      check("a session cannot use another tutor's tutee (404)", (await post("/api/session", { studentName: "", tuteeId: tid, notes: { workedOn: "a" } }, bobC)).status === 404);
    }

    // English 101 course routes
    {
      // A second director, so the AI calls here do not count against carol's rate-limit check below.
      db.prepare("INSERT INTO allowed_users (email, name, role, active) VALUES (?, ?, 'director', 1) ON CONFLICT(email) DO UPDATE SET role = 'director', active = 1").run("gail@augustana.edu", "Gail");
      const gailC = sessionCookieValue(signInFromGoogle({ sub: "g-gail", email: "gail@augustana.edu", email_verified: true, name: "Gail" }));
      const put = (body: unknown, c?: string) => call("/api/courses", { method: "PUT", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }, c);
      check("signed out: GET /api/courses is 401", (await call("/api/courses")).status === 401);
      check("signed out: PUT /api/courses is 401", (await put({ syllabus: "x", units: [] })).status === 401);
      check("signed out: exercise is 401", (await post("/api/courses/exercise", { unit: 0 })).status === 401);
      check("a tutee gets 403 from /api/courses", (await call("/api/courses", {}, tuteeC)).status === 403);
      check("a tutee gets 403 from the exercise route", (await post("/api/courses/exercise", { unit: 0 }, tuteeC)).status === 403);
      check("a tutor reads the course", (await call("/api/courses", {}, alice)).status === 200);
      check("a tutor cannot write the course (403)", (await put({ syllabus: "x", units: [] }, alice)).status === 403);
      check("a tutor cannot propose units (403)", (await post("/api/courses/propose", { syllabus: "x" }, alice)).status === 403);
      check("a tutor cannot load an ARIA file as the syllabus (403)", (await post("/api/courses/load", { driveId: "x" }, alice)).status === 403);
      check("the director writes the course", (await put({ syllabus: "Week 1", units: [{ title: "Unit one", goal: "g", minutes: 20 }] }, carolC)).status === 200);
      check("a tutor reads what the director saved", (await (await call("/api/courses", {}, alice)).text()).includes("Unit one"));
      check("course: units that are not a list are 400", (await put({ syllabus: "x", units: "no" }, carolC)).status === 400);
      check("course: a unit with bad minutes is 400", (await put({ syllabus: "x", units: [{ title: "a", goal: "", minutes: 0 }] }, carolC)).status === 400);
      check("course: a unit with no title is 400", (await put({ syllabus: "x", units: [{ title: "", goal: "", minutes: 20 }] }, carolC)).status === 400);
      check("course: a syllabus that is not text is 400", (await put({ syllabus: 5, units: [] }, carolC)).status === 400);
      check("course: invalid JSON is 400", (await put("{not json", carolC)).status === 400);
      check("course: a 90 KB syllabus is accepted", (await put({ syllabus: "a".repeat(90_000), units: [] }, carolC)).status === 200);
      check("course: a 150 KB syllabus is accepted (limit is about 200 KB)", (await put({ syllabus: "a".repeat(150_000), units: [] }, carolC)).status === 200);
      check("course: a syllabus over 200 KB is 413", (await put({ syllabus: "a".repeat(250_000), units: [] }, carolC)).status === 413);
      const before = Date.now();
      r = await post("/api/courses/propose", { syllabus: "a".repeat(250_000) }, gailC);
      check("propose: an oversize syllabus is 413 before any AI call", r.status === 413 && Date.now() - before < 3000, `${r.status}`);
      check("propose: no syllabus is 400", (await post("/api/courses/propose", {}, gailC)).status === 400);
      check("exercise: a missing unit is 400", (await post("/api/courses/exercise", { unit: 99 }, alice)).status === 400);
      check("exercise: a unit that is not a number is 400", (await post("/api/courses/exercise", { unit: "x" }, alice)).status === 400);
      check("course page: a tutor is sent away from /admin/courses", [302, 303, 307, 308].includes((await call("/admin/courses", {}, alice)).status));
      check("course page: the director opens /admin/courses", (await call("/admin/courses", {}, carolC)).status === 200);
    }

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
    db.prepare("INSERT INTO allowed_users (email, name, role, active) VALUES (?, ?, 'director', 1) ON CONFLICT(email) DO UPDATE SET role = 'director', active = 1").run("frank@augustana.edu", "Frank");
    const frankC = sessionCookieValue(signInFromGoogle({ sub: "g-frank", email: "frank@augustana.edu", email_verified: true, name: "Frank" }));
    const helpAsDirector = await post(`/api/session/${secretSid}/help`, { question: "hi" }, frankC);
    check("the director cannot use the tutor's help route (404)", helpAsDirector.status === 404);

    // 10b. Task forces: own membership only, caps, roles
    const tfJoin = (cookie: string | undefined, key: unknown) => post("/api/task-forces", { key }, cookie);
    check("signed out: GET /api/task-forces is 401", (await call("/api/task-forces")).status === 401);
    check("signed out: POST /api/task-forces is 401", (await tfJoin(undefined, "party-planners")).status === 401);
    check("a student (not asking to be a tutor) gets 403 joining a task force", (await tfJoin(daveC, "party-planners")).status === 403);
    check("a tutor joins a task force", (await tfJoin(alice, "party-planners")).status === 200);
    check("an unknown task force key is 400", (await tfJoin(alice, "nope")).status === 400);
    check("RWC Scholars cannot be joined by a tutor (403)", (await tfJoin(alice, "rwc-scholars")).status === 403);
    check("the director cannot join a task force (403)", (await tfJoin(carolC, "party-planners")).status === 403);
    check("a body naming another person does not move them", (await post("/api/task-forces", { key: "social-media", userId: bob.id, email: "bob@augustana.edu" }, alice)).status === 200 && !db.prepare("SELECT 1 FROM task_force_members WHERE user_id = ?").get(bob.id));
    check("one task force per person (joining again moves them)", (db.prepare("SELECT COUNT(*) AS n FROM task_force_members WHERE user_id = ?").get(a.id) as { n: number }).n === 1);
    check("a tutor cannot place someone else (PUT is 403)", (await call("/api/task-forces", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "bob@augustana.edu", key: "party-planners" }) }, alice)).status === 403);
    const curators: string[] = [];
    for (const n of ["t3", "t4"]) {
      db.prepare("INSERT INTO allowed_users (email, name, role) VALUES (?, ?, 'tutor')").run(`${n}@augustana.edu`, n);
      curators.push(sessionCookieValue(signInFromGoogle({ sub: `g-${n}`, email: `${n}@augustana.edu`, email_verified: true, name: n })));
    }
    check("tutors fill ARIA Curators to its cap of 3", (await tfJoin(alice, "aria-curators")).status === 200 && (await tfJoin(bobC, "aria-curators")).status === 200 && (await tfJoin(curators[0], "aria-curators")).status === 200);
    check("a full task force answers 409", (await tfJoin(curators[1], "aria-curators")).status === 409);
    db.prepare("UPDATE allowed_users SET active = 0 WHERE email = 'bob@augustana.edu'").run();
    check("a deactivated tutor frees their seat", (await tfJoin(curators[1], "aria-curators")).status === 200);
    db.prepare("UPDATE allowed_users SET active = 1 WHERE email = 'bob@augustana.edu'").run();
    r = await call("/api/task-forces", {}, carolC);
    check("the list gives first name and last initial only", r.status === 200 && !(await r.clone().text()).includes("alice@") && (await r.text()).includes('"Alice B."'));
    check("the director places a tutor in RWC Scholars", (await call("/api/task-forces", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "bob@augustana.edu", key: "rwc-scholars" }) }, carolC)).status === 200);
    check("the director removes a tutor from their task force", (await call("/api/task-forces", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "bob@augustana.edu", key: null }) }, carolC)).status === 200 && !db.prepare("SELECT 1 FROM task_force_members WHERE user_id = ?").get(bob.id));

    // 10c. Tagging an ARIA file: director only
    db.prepare("INSERT OR REPLACE INTO aria_docs (drive_id, name, mime, url, modified, text) VALUES ('tagdoc', 'Tag test', 'text/plain', 'https://example.test/t', '2026-01-01', 'x')").run();
    const tagPost = (cookie: string | undefined, body: unknown) => post("/api/aria/tag", body, cookie);
    check("signed out: POST /api/aria/tag is 401", (await tagPost(undefined, { driveId: "tagdoc", key: "party-planners" })).status === 401);
    check("a tutor cannot tag a file (403)", (await tagPost(alice, { driveId: "tagdoc", key: "party-planners" })).status === 403);
    check("the director's tag with an unknown task force is 400", (await tagPost(carolC, { driveId: "tagdoc", key: "nope" })).status === 400);
    check("the director's tag on an unknown file is 404", (await tagPost(carolC, { driveId: "missing", key: "party-planners" })).status === 404);
    check("the director tags a file", (await tagPost(carolC, { driveId: "tagdoc", key: "party-planners" })).status === 200 && (db.prepare("SELECT task_force_key AS k, source FROM aria_doc_tags WHERE drive_id = 'tagdoc'").get() as { k: string; source: string }).source === "director");
    check("the director clears a file's tag", (await tagPost(carolC, { driveId: "tagdoc", key: null })).status === 200 && (db.prepare("SELECT task_force_key AS k FROM aria_doc_tags WHERE drive_id = 'tagdoc'").get() as { k: string | null }).k === null);

    // 11. Logout ends the session on the server (#16)
    r = await call("/api/auth/logout", { method: "POST" });
    check("logout clears the cookie and goes to /login", /gait_session=;/.test(r.headers.get("set-cookie") ?? "") && (r.headers.get("location") ?? "").endsWith("/login"));
    const copied = bobC;
    check("before logout a copied cookie works", (await call("/api/session", {}, copied)).status !== 401);
    r = await call("/api/auth/logout", { method: "POST" }, copied);
    check("logout with a cookie clears it", /gait_session=;/.test(r.headers.get("set-cookie") ?? ""));
    check("after logout the copied cookie is rejected by the API", (await call("/api/session", {}, copied)).status === 401);
    check("after logout the copied cookie is not a signed-in page", (await call("/history", {}, copied)).status !== 200);
    check("a new sign-in after logout works", (await call("/api/session", {}, sessionCookieValue(bob))).status !== 401);
    check("an old-format cookie without a version still works until logout", (await call("/api/session", {}, signToken({ uid: a.id, role: "tutor" }, 600))).status !== 401);

    // 12. AI call caps are counted in the database (#15)
    const { chargeAiCall, aiContext, rateLimit: dbLimit, AI_CALLS_PER_REQUEST } = await import("../lib/limits");
    const caps = aiContext.run({ userId: 424242, calls: 0 }, () => Array.from({ length: AI_CALLS_PER_REQUEST + 2 }, () => chargeAiCall()));
    check("one request may make only a few model calls", caps.slice(0, AI_CALLS_PER_REQUEST).every((c) => c === null) && caps.slice(AI_CALLS_PER_REQUEST).every((c) => c !== null), JSON.stringify(caps));
    check("limit is stored in the database (survives a restart, shared by processes)", dbLimit("probe", 2, 60_000) && dbLimit("probe", 2, 60_000) && !dbLimit("probe", 2, 60_000) && (getDb().prepare("SELECT count(*) AS n FROM rate_hits WHERE key = 'probe'").get() as { n: number }).n === 2);
    check("model calls are counted per minute, not just requests", aiContext.run({ userId: 777, calls: 0 }, () => { let ok = 0; for (let i = 0; i < 100; i++) if (dbLimit("aicall:777", 60, 60_000)) ok++; return ok; }) === 60);
    for (const t of ["sessions", "tasks", "quiz_results"]) check(`${t} has a user_id index`, (getDb().prepare(`PRAGMA index_list(${t})`).all() as { name: string }[]).some((i) => i.name === `${t}_user`));

    // 13. Provider switch: grok/xai through the OpenAI-compatible client, stand-in server (#3)
    const seen: { auth?: string; body?: { model?: string; messages?: { role: string; content: string }[] } }[] = [];
    let aiStatus = 200;
    const fakeAi = http.createServer((q, s2) => {
      let raw = "";
      q.on("data", (c) => (raw += c));
      q.on("end", () => {
        seen.push({ auth: q.headers.authorization, body: JSON.parse(raw || "{}") });
        s2.statusCode = aiStatus;
        s2.setHeader("content-type", "application/json");
        s2.end(JSON.stringify(aiStatus === 200 ? { choices: [{ message: { content: '{"ok":true}' } }] } : { error: { message: "nope" } }));
      });
    });
    await new Promise<void>((res) => fakeAi.listen(0, "127.0.0.1", res));
    const { ask, askJson, hasModel } = await import("../lib/claude");
    const saved = { ...process.env };
    try {
      process.env.GAIT_API_BASE = `http://127.0.0.1:${(fakeAi.address() as { port: number }).port}/v1`;
      process.env.GAIT_PROVIDER = "xai";
      delete process.env.XAI_API_KEY;
      check("grok without a key says what to add", !hasModel() && (await ask({ system: "s", messages: [{ role: "user", content: "hi" }] }).catch((e: Error) => e.message)).includes("XAI_API_KEY"));
      process.env.XAI_API_KEY = "fake-key";
      const got = await askJson<{ ok: boolean }>({ system: "s", messages: [{ role: "user", content: "hi" }] });
      check("GAIT_PROVIDER=xai works like grok (bearer key, grok model, JSON parsed)", got.ok === true && seen[0]?.auth === "Bearer fake-key" && /^grok/.test(seen[0]?.body?.model ?? ""), JSON.stringify(seen[0]));
      check("coaching rules are always in the system prompt", (seen[0]?.body?.messages?.[0]?.content ?? "").includes("AI in writing"));
      aiStatus = 401;
      check("a bad key is a readable error, not a crash", (await ask({ system: "s", messages: [{ role: "user", content: "hi" }] }).catch((e: Error) => e.message)).includes("rejected the key"));
      aiStatus = 429;
      check("rate limited is a readable error", (await ask({ system: "s", messages: [{ role: "user", content: "hi" }] }).catch((e: Error) => e.message)).includes("rate limited"));
    } finally {
      for (const k of ["GAIT_API_BASE", "GAIT_PROVIDER", "XAI_API_KEY"]) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
      fakeAi.close();
    }
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
