/**
 * Checks the session help route, the search fallback and the page layout at 390px and 1280px.
 * Usage: npm run feature-check (it can run while `npm run dev` is running on port 3100).
 * It starts `next dev` on port 3102 with a throwaway database and a stand-in AI server, then stops both.
 * Layout checks drive the installed Google Chrome; set CHROME_PATH to use a different Chrome or Chromium.
 * Screenshots go to .feature-shots/. Set GAIT_DEV_ARGS (for example "--webpack") to pass extra flags to next dev.
 */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const PORT = 3102;
const BASE = `http://localhost:${PORT}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gait-feature-"));
const shots = path.join(process.cwd(), ".feature-shots");
const SECRET = randomBytes(32).toString("base64url");

// Stand-in for Ollama's POST /api/chat. The reply depends on the system prompt.
let picksMode: "empty" | "outOfRange" = "empty";
let modelCalls = 0;
let lastUserPrompt = "";
const fake = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    modelCalls++;
    const body = JSON.parse(raw || "{}") as { messages?: { role: string; content: string }[] };
    const system = body.messages?.find((m) => m.role === "system")?.content ?? "";
    lastUserPrompt = body.messages?.filter((m) => m.role === "user").map((m) => m.content).join("\n") ?? "";
    let content = "COACHING-REPLY";
    if (system.includes("Turn their question into")) content = JSON.stringify({ terms: ["thesis"] });
    else if (system.includes("Pick up to 5")) content = JSON.stringify({ picks: picksMode === "empty" ? [] : [{ i: 99, reason: "x" }] });
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ message: { role: "assistant", content } }));
  });
});

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  ${detail}`}`);
  if (!ok) failures++;
}

const call = (p: string, init: RequestInit = {}, cookie?: string) =>
  fetch(BASE + p, { redirect: "manual", ...init, headers: { ...(init.headers as object), ...(cookie ? { cookie: `gait_session=${cookie}` } : {}) } });
const post = (p: string, body: unknown, cookie?: string) =>
  call(p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, cookie);

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
  await new Promise<void>((r) => fake.listen(0, "127.0.0.1", r));
  const fakePort = (fake.address() as { port: number }).port;
  Object.assign(process.env, {
    GAIT_DB: path.join(dir, "test.db"),
    AUTH_SECRET: SECRET,
    APP_URL: BASE,
    ALLOWED_EMAIL_DOMAIN: "example.test",
    DIRECTOR_EMAIL: "director@example.test",
    GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "test-secret",
    GAIT_PROVIDER: "ollama",
    OLLAMA_HOST: `http://127.0.0.1:${fakePort}`,
  });

  const { getDb } = await import("../lib/db");
  const { signInFromGoogle, sessionCookieValue } = await import("../lib/auth");
  const { keywordSearch } = await import("../lib/search");

  const db = getDb();
  const allow = db.prepare("INSERT INTO allowed_users (email, name, role) VALUES (?, ?, ?)");
  allow.run("director@example.test", "Director", "director");
  allow.run("tutor1@example.test", "Tutor One", "tutor");
  allow.run("tutor2@example.test", "Tutor Two", "tutor");
  const login = (n: number, email: string) => signInFromGoogle({ sub: `f-${n}`, email, email_verified: true, name: email.split("@")[0] });
  const director = login(1, "director@example.test");
  const tutor1 = login(2, "tutor1@example.test");
  const tutor2 = login(3, "tutor2@example.test");
  const directorC = sessionCookieValue(director);
  const t1 = sessionCookieValue(tutor1);
  const t2 = sessionCookieValue(tutor2);

  const notes = { workedOn: "NOTES-WORKED-ON-MARKER", struggles: "NOTES-STRUGGLES-MARKER", wentWell: "NOTES-WENT-WELL-MARKER" };
  const outputs = { email: "Hello", nextSteps: ["Step one"], focusAreas: [{ skill: "Thesis", why: "Needs focus", miniLesson: "Say it in one sentence" }], aiPrompts: [{ prompt: "Ask me questions", whyItHelps: "Coaches" }], dontAskAi: ["Write my essay"] };
  const sid = Number(
    db.prepare("INSERT INTO sessions (student_name, course, notes, outputs, user_id) VALUES (?, ?, ?, ?, ?)")
      .run("Sam", "ENGL 101", JSON.stringify(notes), JSON.stringify(outputs), tutor1.id).lastInsertRowid,
  );
  const doc = db.prepare("INSERT INTO aria_docs (drive_id, name, mime, url, modified, text) VALUES (?, ?, ?, ?, ?, ?)");
  for (const [i, name] of ["Thesis basics", "Thesis templates", "Thesis reports"].entries()) {
    doc.run(`d${i}`, name, "text/plain", `https://example.test/${i}`, "2026-01-01", `A handout about the thesis, part ${i}.`);
  }

  const log = fs.openSync(path.join(dir, "server.log"), "w");
  const server = spawn("npx", ["next", "dev", "-p", String(PORT), ...(process.env.GAIT_DEV_ARGS?.split(" ").filter(Boolean) ?? [])], {
    stdio: ["ignore", log, log], detached: true, env: { ...process.env, GAIT_DIST_DIR: ".next-feature" },
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

    // Help route
    let r = await post(`/api/session/${sid}/help`, { question: "How do I get them talking?" }, t1);
    const j = (await r.json().catch(() => ({}))) as { answer?: string };
    check("help: owner gets 200 with the model's answer", r.status === 200 && j.answer === "COACHING-REPLY", `${r.status} ${JSON.stringify(j)}`);
    check("help: the prompt holds the session's notes", ["NOTES-WORKED-ON-MARKER", "NOTES-STRUGGLES-MARKER", "NOTES-WENT-WELL-MARKER"].every((m) => lastUserPrompt.includes(m)));
    r = await post(`/api/session/${sid}/help`, { question: "   " }, t1);
    check("help: blank question is 400", r.status === 400 && (await r.text()).includes("Type what you would like help with."), String(r.status));
    check("help: another tutor gets 404", (await post(`/api/session/${sid}/help`, { question: "hi" }, t2)).status === 404);
    check("help: signed out is 401", (await post(`/api/session/${sid}/help`, { question: "hi" })).status === 401);
    check("help: 2001 characters is 400", (await post(`/api/session/${sid}/help`, { question: "a".repeat(2001) }, t1)).status === 400);

    // Search fallback (second tutor, so the help checks do not share its rate limit)
    const expected = keywordSearch(["thesis"]).slice(0, 5).map((h) => h.driveId);
    const ids = async (res: Response) => ((await res.json()) as { hits: { driveId: string }[] }).hits.map((h) => h.driveId);
    picksMode = "empty";
    r = await post("/api/search", { q: "thesis" }, t2);
    let got = await ids(r);
    check("search: empty picks give the 3 keyword hits in order", r.status === 200 && expected.length === 3 && got.join() === expected.join(), `${r.status} ${got} vs ${expected}`);
    picksMode = "outOfRange";
    r = await post("/api/search", { q: "thesis" }, t2);
    got = await ids(r);
    check("search: an out-of-range pick gives the same hits", r.status === 200 && got.join() === expected.join(), `${r.status} ${got}`);
    db.exec("DELETE FROM aria_docs");
    const before = modelCalls;
    r = await post("/api/search", { q: "thesis" }, t2);
    const empty = (await r.json()) as { indexEmpty?: boolean };
    check("search: an empty index gives indexEmpty and no model call", r.status === 200 && empty.indexEmpty === true && modelCalls === before, `${r.status} ${JSON.stringify(empty)} calls ${before}->${modelCalls}`);

    // Layout
    const launchOpts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" as const };
    let browser;
    try {
      browser = await chromium.launch(launchOpts);
    } catch (e) {
      throw new Error(`Could not start Chrome. Install Google Chrome or set CHROME_PATH to a Chrome or Chromium binary. (${(e as Error).message.split("\n")[0]})`);
    }
    fs.mkdirSync(shots, { recursive: true });
    const pages: { path: string; cookie?: string }[] = [
      { path: "/", cookie: directorC },
      { path: "/history", cookie: directorC },
      { path: "/session", cookie: directorC },
      { path: `/session/${sid}`, cookie: t1 },
      { path: `/session/${sid}/print`, cookie: t1 },
      { path: "/search", cookie: directorC },
      { path: "/practice", cookie: directorC },
      { path: "/reading", cookie: directorC },
      { path: "/taskforce", cookie: directorC },
      { path: "/admin/tutors", cookie: directorC },
      { path: "/login?error=not_allowed" },
    ];
    for (const [w, h] of [[390, 844], [1280, 800]]) {
      for (const pg of pages) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h } });
        if (pg.cookie) await ctx.addCookies([{ name: "gait_session", value: pg.cookie, url: BASE }]);
        const page = await ctx.newPage();
        try {
          const resp = await page.goto(BASE + pg.path, { waitUntil: "load", timeout: 120_000 });
          await page.waitForTimeout(1000);
          const m = await page.evaluate(() => {
            const portal = document.querySelector("nextjs-portal") as HTMLElement | null;
            const overlay = !!portal?.shadowRoot?.querySelector("[data-nextjs-dialog], [data-nextjs-dialog-overlay], [role=dialog]");
            return { scroll: document.documentElement.scrollWidth, inner: window.innerWidth, overlay };
          });
          const name = `${pg.path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}-${w}.png`;
          await page.screenshot({ path: path.join(shots, name), fullPage: true });
          const status = resp?.status();
          check(
            `layout ${w}px: ${pg.path} (status 200, no sideways scroll, no error overlay)`,
            status === 200 && m.scroll <= m.inner && !m.overlay,
            `status ${status}, width ${m.scroll} > ${m.inner}, overlay ${m.overlay}`,
          );
        } catch (e) {
          check(`layout ${w}px: ${pg.path}`, false, (e as Error).message.split("\n")[0]);
        } finally {
          await ctx.close();
        }
      }
    }
    await browser.close();
    console.log(`\nScreenshots: ${shots}`);
  } finally {
    stop();
    fake.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll feature checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
