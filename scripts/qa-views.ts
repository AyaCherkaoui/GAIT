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
    if (!(await page.locator("#aria-q").evaluate((el) => el === document.activeElement))) throw new Error("search box is not focused on load");
    await page.getByRole("button", { name: "Templates for a thesis statement" }).waitFor();
    await page.locator("#aria-q").fill("thesis help");
    await page.keyboard.press("Control+Enter");
    await page.getByRole("link", { name: "Open in Drive" }).first().waitFor({ timeout: 30_000 });
    await page.getByText("Why it matched").first().waitFor();
    await snap("result");
    await page.locator("#aria-q").fill("zzzz qqqq nothing");
    await page.getByRole("button", { name: "Find files" }).click();
    await page.getByRole("heading", { name: "Nothing matched" }).or(page.getByRole("link", { name: "Open in Drive" }).first()).waitFor({ timeout: 30_000 });
    await page.getByRole("button", { name: "thesis help" }).waitFor();
    await snap("recent");
  };
  const taskforce: Step = async (page, snap) => {
    await page.locator("input").first().fill("Citation workshop");
    await page.locator("textarea").first().fill("Plan a one-hour workshop for first-years.");
    await page.keyboard.press("Control+Enter");
    await page.getByRole("button", { name: "Copy outline" }).first().waitFor({ timeout: 30_000 });
    const box = page.getByRole("checkbox").first();
    await box.check();
    await page.getByText("1 of 5 done").first().waitFor();
    await page.reload({ waitUntil: "load" });
    await page.getByRole("button", { name: "Reopen" }).first().click();
    await page.getByText("1 of 5 done").first().waitFor();
    check("taskforce: ticked step is still ticked after reload", await page.getByRole("checkbox").first().isChecked());
    await snap("result");
  };
  const policies: Step = async (page, snap) => {
    await page.getByLabel("Course code", { exact: true }).fill("ENGL 101");
    await page.getByLabel("Professor", { exact: true }).fill("Dr. Rivera");
    await page.getByLabel("AI policy", { exact: true }).selectOption("limited");
    await page.getByLabel("Details", { exact: true }).fill("OK for brainstorming, must be disclosed");
    await page.getByRole("button", { name: "Save policy" }).click();
    await page.getByText("OK for brainstorming").first().waitFor({ timeout: 30_000 });
    await page.getByText("Draft: director to confirm").first().waitFor();
    await page.getByLabel("Filter by course code").fill("zzz");
    await page.getByText("No policy matches").waitFor();
    await page.getByLabel("Filter by course code").fill("ENGL");
    await page.getByRole("button", { name: "Copy", exact: true }).first().waitFor();
    await snap("saved");
  };
  const aiTalk: Step = async (page, snap) => {
    await page.getByRole("button", { name: "Tailor it" }).click();
    await page.getByRole("button", { name: "Tailor it" }).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(2500);
    await snap("tailored");
    await page.getByText("Draft: director to confirm").first().waitFor();
    check("ai-talk: scripts have Copy buttons", (await page.getByRole("button", { name: "Copy", exact: true }).count()) > 0);
    await page.getByRole("button", { name: "Ownership questions" }).click();
    await snap("ownership");
  };
  const practice: Step = async (page, snap) => {
    await page.getByRole("button", { name: "Role-play a session" }).click();
    await page.getByRole("button", { name: "Start role-play" }).click();
    await page.getByText("mostly need help").waitFor({ timeout: 30_000 });
    await page.fill("#rp-draft", "What would you like to work on today?");
    await page.getByRole("button", { name: "Send reply" }).click();
    await page.getByText("Student").nth(1).waitFor();
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: "End and get feedback" }).click();
    await page.getByRole("heading", { name: "What worked" }).waitFor({ timeout: 30_000 });
    await page.getByRole("heading", { name: "One thing to try next time" }).waitFor();
    await snap("roleplay");
    await page.getByRole("button", { name: "5-question refresher" }).click();
    await page.getByRole("button", { name: "Start quiz" }).click();
    await page.getByText("Sample question 1").waitFor({ timeout: 30_000 });
    for (let i = 1; i <= 5; i++) {
      await page.getByText(`Question ${i} of 5`).waitFor();
      await page.getByRole("button", { name: /^(Ask what|Fix the grammar)/ }).nth(i === 1 ? 1 : 0).click(); // miss the first one on purpose
      await page.getByText("Asking keeps the student in charge").waitFor();
      if (i === 1) await snap("quiz-explained");
      await page.getByRole("button", { name: i < 5 ? "Next question" : "See my score" }).click();
    }
    await page.getByText("Your score: 4 of 5").waitFor();
    await snap("quiz-score");
    await page.getByRole("button", { name: "Try the ones you missed" }).click();
    await page.getByText("Missed question 1 of 1").waitFor();
    await page.getByRole("heading", { name: "Your quiz scores" }).waitFor();
    await page.getByText(/Trending|Holding steady|Take another quiz/).first().waitFor();
    await snap("quiz-retry");
  };
  const reading: Step = async (page) => {
    await page.getByText("Why read this").first().waitFor();
    await page.getByRole("link", { name: "News" }).first().waitFor();
    check("reading: no article feed section", !(await page.getByText("Recent articles").count()));
  };
  const news: Step = async (page, snap) => {
    await page.getByRole("link", { name: /Coaching with AI/ }).waitFor({ timeout: 30_000 });
    await page.getByText("Could not load: Fixture Broken Source").waitFor();
    await snap("list");
    await page.getByRole("button", { name: "AI and writing" }).click();
    await page.getByText("Non-directive tutoring").waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByRole("searchbox", { name: "Search articles" }).fill("revise");
    await page.getByText("Non-directive tutoring").waitFor({ state: "hidden" });
    await page.getByRole("searchbox", { name: "Search articles" }).fill("");
    await page.getByRole("button", { name: "Try this with a student" }).first().click();
    await page.getByText("One move to try").waitFor({ timeout: 30_000 });
    await snap("try-this");
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
    { path: "/reading", steps: reading },
    { path: "/news", steps: news },
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
    stdio: ["ignore", log, log], detached: true, env: { ...process.env, GAIT_DIST_DIR: ".next-qa", GAIT_TEST_TOOLS: "0", NEWS_FIXTURE: "1" },
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
                // Something sitting on top of a link or button makes it unclickable: look at what is on top at its centre.
                const blocked: string[] = [];
                for (const el of document.querySelectorAll("a[href], button, select, input, textarea, summary")) {
                  const r = el.getBoundingClientRect();
                  if (!r.width || !r.height || getComputedStyle(el).visibility === "hidden" || (el as HTMLButtonElement).disabled || el.classList.contains("sr-only")) continue;
                  if (el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox" || el.type === "hidden")) continue;
                  const x = r.left + r.width / 2, y = r.top + Math.min(r.height / 2, 20);
                  if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
                  const top = document.elementFromPoint(x, y);
                  if (top && top !== el && !el.contains(top) && !top.contains(el)) blocked.push(`${(el.textContent || el.tagName).trim().slice(0, 24)} under ${top.tagName.toLowerCase()}`);
                }
                return { scroll: document.documentElement.scrollWidth, inner: window.innerWidth, overlay, small, blocked };
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
            check(`${label}: nothing covers a link or button`, m.blocked.length === 0, [...new Set(m.blocked)].slice(0, 4).join("; "));
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
    // tutor-a: shell, Home, After session, session detail and History interactions.
    {
      const open = async (c: string, w: number, h = 900) => {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, permissions: ["clipboard-read", "clipboard-write"] });
        await ctx.addCookies([{ name: "gait_session", value: c, url: BASE }]);
        return { ctx, page: await ctx.newPage() };
      };
      const flow = async (name: string, c: string, w: number, fn: (page: Page) => Promise<void>) => {
        const { ctx, page } = await open(c, w);
        try {
          await fn(page);
          check(name, true);
        } catch (e) {
          check(name, false, (e as Error).message.split("\n")[0]);
          await page.screenshot({ path: path.join(shots, `flow-failed-${name.replace(/[^a-z0-9]+/gi, "_")}.png`), fullPage: true }).catch(() => {});
        } finally {
          await ctx.close();
        }
      };
      const T = { timeout: 30_000 };

      await flow("home (tutor): primary button, pick up, recent sessions, quick actions, tip", cookie(tutor), 1280, async (page) => {
        await page.goto(BASE + "/");
        await page.getByRole("link", { name: /Log a session/ }).first().waitFor(T);
        await page.getByRole("heading", { name: "Pick up where you left off" }).waitFor(T);
        await page.getByRole("heading", { name: "Recent sessions" }).waitFor(T);
        for (const l of ["Search ARIA", "Practice", "Task force"]) await page.getByRole("link", { name: new RegExp(l) }).first().waitFor(T);
        await page.getByText("Coaching tip.").waitFor(T);
      });
      await flow("home (director): pending requests strip links to the tutor list", cookie(director), 1280, async (page) => {
        await page.goto(BASE + "/");
        const strip = page.getByRole("link", { name: /request waiting/ });
        await strip.waitFor(T);
        if ((await strip.getAttribute("href")) !== "/admin/tutors") throw new Error("strip does not link to /admin/tutors");
      });
      await flow("shell (director, desktop): grouped nav, active page, Admin links, skip link", cookie(director), 1280, async (page) => {
        await page.goto(BASE + "/history");
        const nav = page.getByRole("navigation", { name: "Main" });
        for (const g of ["Today", "Tools", "Learn", "Admin"]) await nav.getByText(g, { exact: true }).waitFor(T);
        for (const l of ["News", "Sessions", "Tutor list", "Impact"]) await nav.getByRole("link", { name: l, exact: true }).waitFor(T);
        if ((await nav.getByRole("link", { name: "History", exact: true }).getAttribute("aria-current")) !== "page") throw new Error("History is not marked current");
        await page.getByText("Sign out").first().waitFor(T);
        await page.keyboard.press("Tab");
        const skip = page.getByRole("link", { name: "Skip to content" });
        if (!(await skip.isVisible())) throw new Error("skip link is not visible on focus");
      });
      await flow("shell (student): Coach link, no tutor tools", cookie(tutee), 1280, async (page) => {
        await page.goto(BASE + "/");
        const nav = page.getByRole("navigation", { name: "Main" });
        await nav.getByRole("link", { name: "Coach", exact: true }).waitFor(T);
        if (await nav.getByRole("link", { name: "After session" }).count()) throw new Error("student sees After session");
      });
      await flow("shell (phone): menu opens, closes on navigate, user footer is reachable", cookie(tutor), 390, async (page) => {
        await page.goto(BASE + "/");
        await page.getByRole("button", { name: "Menu" }).click();
        await page.getByRole("button", { name: "Sign out" }).waitFor(T);
        await page.getByRole("link", { name: "History", exact: true }).click();
        await page.waitForURL("**/history", T);
        await page.getByRole("button", { name: "Menu" }).waitFor(T);
      });

      await flow("after session: validation, Ctrl+Enter, draft restore and Clear, tabs, Copy, Mark email sent", cookie(tutor), 1280, async (page) => {
        await page.goto(BASE + "/session");
        await page.getByRole("button", { name: "Write the follow-up" }).click();
        await page.getByText("Add what you worked on or what the student struggled with.").first().waitFor(T);
        await page.fill("#workedOn", "Draft survives a reload.");
        await page.waitForTimeout(700);
        await page.reload();
        await page.getByText("Draft restored.").waitFor(T);
        if ((await page.inputValue("#workedOn")) !== "Draft survives a reload.") throw new Error("draft text was not restored");
        await page.getByRole("button", { name: "Clear" }).click();
        if ((await page.inputValue("#workedOn")) !== "") throw new Error("Clear did not empty the form");
        // A failed request keeps the form filled and offers Try again.
        await page.fill("#workedOn", "We worked on the thesis.");
        await page.route("**/api/session", (r) => (r.request().method() === "POST" ? r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Something went wrong. Try again." }) }) : r.continue()));
        await page.keyboard.press("Control+Enter");
        await page.getByRole("button", { name: "Try again" }).waitFor(T);
        if ((await page.inputValue("#workedOn")) !== "We worked on the thesis.") throw new Error("notes were lost after an error");
        await page.unroute("**/api/session");
        await page.getByRole("button", { name: "Try again" }).click();
        await page.getByText("Writing the follow-up").waitFor(T);
        if ((await page.inputValue("#workedOn")) !== "We worked on the thesis.") throw new Error("form emptied while working");
        await page.getByRole("heading", { name: "Email draft" }).waitFor(T);
        await page.getByRole("tab", { name: "Next steps" }).click();
        await page.getByText("Write your thesis in one sentence").waitFor(T);
        await page.getByRole("tab", { name: "AI prompts" }).click();
        await page.getByRole("button", { name: "Copy", exact: true }).first().click();
        await page.getByRole("button", { name: "Copied" }).waitFor(T);
        await page.getByRole("button", { name: "Mark email sent" }).click();
        await page.getByText("Email sent", { exact: true }).waitFor(T);
        await page.getByRole("link", { name: "Print next steps" }).waitFor(T);
      });
      await flow("session detail: breadcrumb, reflection autosave, previous/next", cookie(tutor), 1280, async (page) => {
        await page.goto(BASE + `/session/${sid}`);
        await page.getByRole("link", { name: "← History" }).waitFor(T);
        await page.fill("#f-learned", "Autosaved text");
        await page.getByRole("status").filter({ hasText: /^Saved / }).waitFor(T);
        await page.reload();
        await done(page);
        await page.waitForFunction(() => (document.getElementById("f-learned") as HTMLTextAreaElement | null)?.value === "Autosaved text", undefined, T);
        await page.getByRole("link", { name: /^Next:/ }).click();
        await page.waitForURL((u) => !u.pathname.endsWith(`/${sid}`), T);
        await page.getByRole("link", { name: /^← Previous/ }).waitFor(T);
        await page.getByRole("link", { name: "← History" }).click();
        await page.waitForURL("**/history", T);
      });
      await flow("history: search, filters, week groups, status chips, clickable rows", cookie(tutor), 1280, async (page) => {
        await page.goto(BASE + "/history");
        await page.getByText(/^Week of /).first().waitFor(T);
        await page.getByText("Reflection saved").or(page.getByText("No reflection yet")).first().waitFor(T);
        await page.fill("#h-search", "Alex");
        await page.getByText(/^1 of \d+ sessions?$/).waitFor(T);
        await page.fill("#h-search", "zzzz");
        await page.getByText("No matches").waitFor(T);
        await page.getByRole("button", { name: "Clear filters" }).click();
        await page.selectOption("#h-student", "Sam");
        await page.getByText(/^\d+ of \d+ sessions?$/).waitFor(T);
        if (await page.getByRole("link", { name: /HIST 210/ }).count()) throw new Error("the Sam filter still shows Alex's session");
        await page.getByRole("link", { name: /Sam/ }).first().click();
        await page.waitForURL(/\/session\/\d+$/, T);
      });
      allow.run("empty@example.test", "Eve Empty", "tutor");
      const empty = login(6, "empty@example.test", "Eve Empty");
      await flow("history (new tutor, no sessions): empty state offers Log a session", cookie(empty), 1280, async (page) => {
        await page.goto(BASE + "/history");
        await page.getByRole("link", { name: "Log a session" }).waitFor(T);
      });
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
