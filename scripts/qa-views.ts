/**
 * Opens every page in every role view (new user, student, tutor, director, signed out) at 390px and 1280px
 * and fails on sideways scroll, a non-200 status, console errors, an error overlay or tap targets under 40px.
 * Usage: npm run qa-views. It starts `next dev` on port 3104 with a throwaway database and a stand-in AI server.
 * Screenshots go to .qa-shots/. CHROME_PATH picks a different Chrome; GAIT_DEV_ARGS adds flags to next dev.
 */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { chromium, type Page } from "playwright-core";

const PORT = Number(process.env.CHECK_PORT) || 3104; // CHECK_PORT lets several checkouts run checks at once
const BASE = `http://localhost:${PORT}`;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gait-qa-"));
const shots = path.join(process.cwd(), ".qa-shots");
const SECRET = randomBytes(32).toString("base64url");

const questions = [0, 1, 2, 3, 4].map((i) => ({
  q: `Sample question ${i + 1}: what is the best first move when a student hands you a draft?`,
  choices: ["Ask what they want to work on", "Fix the grammar first", "Rewrite the introduction", "Read it silently and leave"],
  answer: 0,
  why: "Asking keeps the student in charge of the session and the paper.",
}));
const sample = {
  terms: ["thesis"],
  picks: [{ i: 0, reason: "Matches the question." }],
  email: "Hi Sam,\n\nGreat work today on your thesis. Before we meet again, try writing your claim in one sentence.\n\nBest,\nTutor",
  nextSteps: ["Write your thesis in one sentence", "Mark each paragraph with the claim it supports"],
  focusAreas: [{ skill: "Thesis", why: "The claim is buried in paragraph two.", miniLesson: "Say the point out loud first, then write it." }],
  aiPrompts: [{ prompt: "Ask me three questions that help me find my main claim. Do not write it for me.", whyItHelps: "The student still does the thinking." }],
  dontAskAi: ["Write my introduction", "Make this sound smarter"],
  steps: ["Read the brief", "List audiences", "Draft a schedule", "Pick a first deliverable", "Check with the director"],
  outline: "Goals\n- Who is it for\n\nPlan\n- Dates\n- Owners",
  questionsToClarify: ["What is the deadline?", "Who approves the final handout?"],
  worked: ["You asked an open question: \"What would you like to work on?\""],
  missed: ["You did not set an agenda."],
  tryNext: ["Try: \"What do you want to leave with today?\""],
  questions,
};

// Stand-in for Ollama's POST /api/chat: a short delay so the loading state can be seen, then canned output.
const fake = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw || "{}") as { format?: string };
    setTimeout(() => {
      const content = body.format === "json" ? JSON.stringify(sample) : "That is a fair question. I mostly need help making the ending stronger.";
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ message: { role: "assistant", content } }));
    }, 1500);
  });
});

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  ${detail}`}`);
  if (!ok) failures++;
}

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

type Step = (page: Page, snap: (label: string) => Promise<void>) => Promise<void>;
type View = { path: string; steps?: Step };
type Role = { name: string; cookie?: string; views: View[] };

const done = (page: Page) => page.waitForFunction(() => !document.body.innerText.includes("Loading…"), undefined, { timeout: 30_000 });

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
  const db = getDb();
  const allow = db.prepare("INSERT INTO allowed_users (email, name, role) VALUES (?, ?, ?)");
  allow.run("tutor@example.test", "Tutor Tina", "tutor");
  const login = (n: number, email: string, name: string) => signInFromGoogle({ sub: `qa-${n}`, email, email_verified: true, name });
  const director = login(1, "director@example.test", "Dana Director");
  const tutor = login(2, "tutor@example.test", "Tina Tutor");
  const tutee = login(3, "student@example.test", "Sam Student");
  const fresh = login(4, "new@example.test", "Nia Newcomer");
  const pending = login(5, "pending@example.test", "Pat Pending");
  db.prepare("UPDATE users SET onboarded = 1 WHERE id = ?").run(tutee.id);
  db.prepare("UPDATE users SET onboarded = 1, requested_role = 'tutor' WHERE id = ?").run(pending.id);
  const cookie = (u: typeof tutor) => sessionCookieValue(u);

  const notes = { workedOn: "Thesis and paragraph order in a history paper.", struggles: "Stating the claim directly.", wentWell: "Great questions about the sources." };
  const outputs = {
    email: sample.email, nextSteps: sample.nextSteps, focusAreas: sample.focusAreas, aiPrompts: sample.aiPrompts, dontAskAi: sample.dontAskAi,
  };
  const ins = db.prepare("INSERT INTO sessions (student_name, course, notes, outputs, user_id) VALUES (?, ?, ?, ?, ?)");
  const sid = Number(ins.run("Sam", "ENGL 101", JSON.stringify(notes), JSON.stringify(outputs), tutor.id).lastInsertRowid);
  ins.run("Alex", "HIST 210", JSON.stringify(notes), JSON.stringify(outputs), tutor.id);
  const dsid = Number(ins.run("Jo", "BIOL 120", JSON.stringify(notes), JSON.stringify(outputs), director.id).lastInsertRowid);
  db.prepare("INSERT INTO quiz_results (score, total, topic, user_id) VALUES (4, 5, 'Thesis statements', ?)").run(tutor.id);
  db.prepare("INSERT INTO quiz_results (score, total, topic, user_id) VALUES (2, 5, 'MLA and APA citations', ?)").run(tutor.id);
  db.prepare("INSERT INTO tasks (title, description, plan, related, user_id) VALUES (?, ?, ?, ?, ?)").run(
    "Fall workshop", "Plan a workshop on citations", JSON.stringify({ steps: sample.steps, outline: sample.outline, questionsToClarify: sample.questionsToClarify }), "[]", tutor.id,
  );
  const doc = db.prepare("INSERT INTO aria_docs (drive_id, name, mime, url, modified, text) VALUES (?, ?, ?, ?, ?, ?)");
  for (const [i, name] of ["Thesis basics", "Thesis templates", "Thesis reports"].entries()) {
    doc.run(`d${i}`, name, "text/plain", `https://example.test/${i}`, "2026-01-01", `A handout about the thesis, part ${i}.`);
  }

  const session: Step = async (page, snap) => {
    await page.fill("#studentName", "Sam");
    await page.fill("#course", "ENGL 101, history paper");
    await page.fill("#workedOn", "We worked on the thesis.");
    await page.fill("#struggles", "Stating the claim.");
    await page.getByRole("button", { name: "Write the follow-up" }).click();
    await page.getByText("Writing the follow-up").waitFor();
    await snap("working");
    await page.getByRole("heading", { name: "Email draft" }).waitFor({ timeout: 30_000 });
    await snap("result");
  };
  const detail: Step = async (page, snap) => {
    await page.fill("#learned", "Open questions help.").catch(() => {});
    await snap("filled");
  };
  const search: Step = async (page, snap) => {
    await page.locator("input, textarea").first().fill("thesis help");
    await page.getByRole("button", { name: /search|find/i }).first().click();
    await page.waitForTimeout(3500);
    await snap("result");
  };
  const taskforce: Step = async (page, snap) => {
    await page.locator("input").first().fill("Citation workshop");
    await page.locator("textarea").first().fill("Plan a one-hour workshop for first-years.");
    await page.getByRole("button", { name: /plan|steps|start|get/i }).first().click();
    await page.waitForTimeout(3500);
    await snap("result");
  };
  const policies: Step = async (page, snap) => {
    await page.getByLabel("Course code", { exact: true }).fill("ENGL 101");
    await page.getByLabel("Professor", { exact: true }).fill("Dr. Rivera");
    await page.getByLabel("AI policy", { exact: true }).selectOption("limited");
    await page.getByLabel("Details", { exact: true }).fill("OK for brainstorming, must be disclosed");
    await page.getByRole("button", { name: "Save policy" }).click();
    await page.getByText("OK for brainstorming").first().waitFor({ timeout: 30_000 });
    await snap("saved");
  };
  const aiTalk: Step = async (page, snap) => {
    await page.getByRole("button", { name: "Tailor it" }).click();
    await page.getByRole("button", { name: "Tailor it" }).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(2500);
    await snap("tailored");
    await page.getByRole("button", { name: "Ownership questions" }).click();
    await snap("ownership");
  };
  const practice: Step = async (page, snap) => {
    await page.getByRole("button", { name: "Start role-play" }).click();
    await page.getByText("mostly need help").waitFor({ timeout: 30_000 });
    await page.fill("#rp-draft", "What would you like to work on today?");
    await page.getByRole("button", { name: "Send reply" }).click();
    await page.getByText("Student").nth(1).waitFor();
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: "End and get feedback" }).click();
    await page.getByRole("heading", { name: "What worked" }).waitFor({ timeout: 30_000 });
    await snap("roleplay");
    await page.getByRole("button", { name: "Start quiz" }).click();
    await page.getByText("Sample question 1").waitFor({ timeout: 30_000 });
    for (const li of await page.locator("ol > li").all()) await li.getByRole("button").first().click().catch(() => {});
    await snap("quiz");
  };
  const welcome: Step = async (page, snap) => {
    await page.getByText("Tutor", { exact: true }).first().click();
    await snap("tutor-chosen");
  };

  const debrief: Step = async (page, snap) => {
    await page.getByRole("button", { name: "4", exact: true }).click();
    await page.getByLabel("One line").fill("A long shift.");
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByText("Saved. Thanks for checking in.").waitFor({ timeout: 30_000 });
    await snap("saved");
  };

  const staff = (c: string): Role["views"] => [
    { path: "/" },
    { path: "/session", steps: session },
    { path: `/session/${sid}`, steps: detail },
    { path: `/session/${sid}/print` },
    { path: "/history" },
    { path: "/search", steps: search },
    { path: "/taskforce", steps: taskforce },
    { path: "/practice", steps: practice },
    { path: "/reading" },
    { path: "/debrief", steps: debrief },
    { path: "/voice" },
    { path: "/policies", steps: policies },
    { path: "/ai-talk", steps: aiTalk },
  ].map((v) => ({ ...v, path: v.path.replace(String(sid), c === "director" ? String(dsid) : String(sid)) }));

  const roles: Role[] = [
    { name: "new", cookie: cookie(fresh), views: [{ path: "/welcome", steps: welcome }] },
    { name: "student", cookie: cookie(tutee), views: [{ path: "/" }] },
    { name: "student-pending", cookie: cookie(pending), views: [{ path: "/" }] },
    { name: "tutor", cookie: cookie(tutor), views: staff("tutor") },
    { name: "director", cookie: cookie(director), views: [...staff("director"), { path: "/admin/tutors" }, { path: "/impact" }] },
    { name: "out", views: [{ path: "/login" }, { path: "/login?error=domain" }] },
  ];

  const log = fs.openSync(path.join(dir, "server.log"), "w");
  const server = spawn("npx", ["next", "dev", "-p", String(PORT), ...(process.env.GAIT_DEV_ARGS?.split(" ").filter(Boolean) ?? [])], {
    stdio: ["ignore", log, log], detached: true, env: { ...process.env, GAIT_DIST_DIR: ".next-qa", GAIT_TEST_TOOLS: "0" },
  });
  const stop = () => {
    try {
      process.kill(-server.pid!);
    } catch {
      /* already gone */
    }
  };
  try {
    await waitForServer();
    const launchOpts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" as const };
    const browser = await chromium.launch(launchOpts).catch((e) => {
      throw new Error(`Could not start Chrome. Install Google Chrome or set CHROME_PATH. (${(e as Error).message.split("\n")[0]})`);
    });
    fs.rmSync(shots, { recursive: true, force: true });
    fs.mkdirSync(shots, { recursive: true });

    for (const [w, h] of [[390, 844], [1280, 800]]) {
      for (const role of roles) {
        for (const view of role.views) {
          const ctx = await browser.newContext({ viewport: { width: w, height: h } });
          if (role.cookie) await ctx.addCookies([{ name: "gait_session", value: role.cookie, url: BASE }]);
          const page = await ctx.newPage();
          const errors: string[] = [];
          page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)));
          page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
          const base = `${role.name}-${view.path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}-${w}`;
          const snap = (label: string) => page.screenshot({ path: path.join(shots, `${base}-${label}.png`), fullPage: true }).then(() => {});
          const label = `${role.name} ${w}px ${view.path}`;
          try {
            const resp = await page.goto(BASE + view.path, { waitUntil: "load", timeout: 120_000 });
            await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
            const loaded = await done(page).then(() => true, () => false);
            await page.waitForTimeout(300);
            const measure = () =>
              page.evaluate(() => {
                const portal = document.querySelector("nextjs-portal") as HTMLElement | null;
                const overlay = !!portal?.shadowRoot?.querySelector("[data-nextjs-dialog], [data-nextjs-dialog-overlay], [role=dialog]");
                const small: string[] = [];
                for (const el of document.querySelectorAll("a, button, select, input, textarea, summary")) {
                  const r = el.getBoundingClientRect();
                  const cs = getComputedStyle(el);
                  if (!r.width || !r.height || cs.visibility === "hidden" || el.classList.contains("sr-only")) continue;
                  if (el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox" || el.type === "hidden")) continue;
                  if (el.closest("p, li > span, .prose")) continue; // links inside running text
                  if (r.height < 40 && !(el instanceof HTMLAnchorElement && cs.display === "inline")) small.push(`${el.tagName.toLowerCase()} "${(el.textContent || "").trim().slice(0, 24)}" ${Math.round(r.height)}px`);
                }
                return { scroll: document.documentElement.scrollWidth, inner: window.innerWidth, overlay, small };
              });
            await snap("page");
            const m = await measure();
            const status = resp?.status();
            check(
              `${label} (200, loaded, no sideways scroll, no overlay)`,
              status === 200 && loaded && m.scroll <= m.inner && !m.overlay,
              `status ${status}, loaded ${loaded}, width ${m.scroll} > ${m.inner}, overlay ${m.overlay}`,
            );
            if (view.steps) {
              await view.steps(page, snap);
              const after = await measure();
              check(`${label} after interaction: no sideways scroll`, after.scroll <= after.inner, `width ${after.scroll} > ${after.inner}`);
              m.small.push(...after.small);
            }
            if (w === 390 && !view.path.endsWith("/print")) check(`${label}: tap targets 40px or taller`, m.small.length === 0, [...new Set(m.small)].slice(0, 6).join("; "));
            check(`${label}: no console errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
          } catch (e) {
            check(label, false, (e as Error).message.split("\n")[0]);
            await snap("failed").catch(() => {});
          } finally {
            await ctx.close();
          }
        }
      }
    }
    // A student must not reach tutor pages.
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "gait_session", value: cookie(tutee), url: BASE }]);
    const p = await ctx.newPage();
    await p.goto(BASE + "/session");
    check("student opening /session does not get the tutor tool", !(await p.locator("#workedOn").count()), p.url());
    await ctx.close();
    await browser.close();
    console.log(`\nScreenshots: ${shots}`);
  } finally {
    stop();
    fake.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll qa views passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
