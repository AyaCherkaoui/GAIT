import Link from "next/link";
import { redirect } from "next/navigation";
import { Chip, Empty } from "@/components/ui";
import { fmtDate } from "@/components/format";
import { getUser, type Role } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listSessions } from "@/lib/sessions";

export const dynamic = "force-dynamic";

const QUICK = [
  ["/search", "Search ARIA", "Find the right handout."],
  ["/practice", "Practice", "Role-play or take a refresher."],
  ["/taskforce", "Task force", "Turn a task into steps."],
] as const;

const TIPS = [
  "Start by asking what the student wants to leave with today.",
  "Ask one open question, then wait. The silence is the student thinking.",
  "Have the student read their own draft aloud before you comment.",
  "Praise something specific the student did, not the paper in general.",
  "Point out one pattern, not every error. The student fixes the rest.",
  "End by asking the student to say their next step in their own words.",
  "When a student asks you to fix it, ask what they think is wrong first.",
] as const;

function tipOfTheDay() {
  const day = Math.floor(Date.now() / 86_400_000);
  return TIPS[day % TIPS.length];
}

function pendingRequests(): number {
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM users WHERE requested_role IS NOT NULL").get() as { n: number };
  return row.n;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function Hero({ role, name }: { role: Role; name: string }) {
  const line = {
    director: "Keep the tutor list current, then see how sessions are going.",
    tutor: "Log your last session, or sharpen a skill before the next one.",
    tutee: "Use AI to learn writing, not to skip it.",
  }[role];
  return (
    <header className="pad rise -mx-4 -mt-8 border-b border-stone-200 px-4 py-10 pl-[4.25rem] sm:-mx-8 sm:-mt-10 sm:px-8 sm:py-14 sm:pl-[5.75rem]">
      <Chip tone="ink">{role === "tutee" ? "Student" : role === "director" ? "Director" : "Tutor"}</Chip>
      <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
        {greeting()}, {name}.
      </h1>
      <p className="mt-2 max-w-lg text-lg text-stone-600">{line}</p>
    </header>
  );
}

function StaffHome({ role, userId }: { role: Role; userId: number }) {
  const all = listSessions(userId);
  const recent = all.slice(0, 3);
  const resume = all.find((s) => !s.reflection);
  const waiting = role === "director" ? pendingRequests() : 0;
  return (
    <div className="space-y-10 pt-10">
      {role === "director" && (
        <Link href="/admin/tutors" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold-300 bg-gold-50 p-4 transition hover:border-gold-400">
          <p className="text-stone-800">
            <span className="font-semibold text-ink">{waiting === 0 ? "No requests waiting" : `${waiting} ${waiting === 1 ? "request" : "requests"} waiting`}</span>
            {waiting === 0 ? ". Manage the tutor list." : " for your approval."}
          </p>
          <span className="text-sm font-semibold text-ink underline underline-offset-4">Open tutor list</span>
        </Link>
      )}

      <Link href="/session" className="group flex flex-wrap items-center justify-between gap-4 rounded-lg bg-ink p-6 text-white transition hover:bg-indigo-800 sm:p-8">
        <div className="max-w-lg">
          <h2 className="font-display text-3xl font-semibold">Log a session</h2>
          <p className="mt-1.5 text-indigo-100">Paste your notes. Get a follow-up email, printable next steps and AI prompts that coach the student instead of writing for them.</p>
        </div>
        <span className="rounded-md bg-gold-300 px-4 py-2.5 text-sm font-bold text-ink transition group-hover:bg-gold-400">Log a session</span>
      </Link>

      {resume && (
        <section aria-labelledby="resume">
          <h2 id="resume" className="mb-3 font-display text-2xl font-semibold text-ink">Pick up where you left off</h2>
          <Link href={`/session/${resume.id}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg border border-gold-300/70 bg-gold-50 px-5 py-4 hover:border-gold-400">
            <span className="font-semibold text-ink">{resume.student_name || "Student"} <span className="font-normal text-stone-700">in {resume.course || "no course"}</span></span>
            <span className="text-sm text-stone-700">{fmtDate(resume.created_at)} · add your reflection</span>
          </Link>
        </section>
      )}

      <section aria-labelledby="recent">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="recent" className="font-display text-2xl font-semibold text-ink">Recent sessions</h2>
          <Link href="/history" className="inline-flex min-h-10 items-center text-sm font-medium text-indigo-700 underline underline-offset-4">All history</Link>
        </div>
        {recent.length === 0 ? (
          <Empty title="No sessions yet">Start with “Log a session” after your next appointment. It will show here.</Empty>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-3">
            {recent.map((s) => (
              <li key={s.id}>
                <Link href={`/session/${s.id}`} className="block h-full rounded-lg border border-stone-200 bg-white p-4 hover:border-stone-400">
                  <span className="block font-semibold text-ink">{s.student_name || "Student"}</span>
                  <span className="block text-sm text-stone-600">{s.course || "no course"}</span>
                  <span className="mt-2 flex flex-wrap items-center gap-2 text-sm text-stone-600">
                    {fmtDate(s.created_at)}
                    <Chip tone={s.reflection ? "plain" : "gold"}>{s.reflection ? "Reflected" : "Needs reflection"}</Chip>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="quick">
        <h2 id="quick" className="mb-3 font-display text-2xl font-semibold text-ink">Quick actions</h2>
        <ul className="grid gap-x-8 sm:grid-cols-3">
          {QUICK.map(([href, title, text]) => (
            <li key={href} className="border-t border-stone-200">
              <Link href={href} className="group block py-4">
                <span className="font-semibold text-ink group-hover:underline group-hover:decoration-gold-400 group-hover:decoration-2 group-hover:underline-offset-4">{title}</span>
                <span className="mt-0.5 block text-sm text-stone-600">{text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="border-l-4 border-gold-300 pl-4 text-stone-700"><span className="font-semibold text-ink">Coaching tip.</span> {tipOfTheDay()}</p>
    </div>
  );
}

const ASK_INSTEAD = [
  ["Write my conclusion.", "Ask me three questions that help me figure out what my conclusion should say."],
  ["Fix my grammar.", "Point out one pattern of grammar mistakes in this paragraph and explain it. Don’t rewrite it."],
  ["Make this sound smarter.", "Which sentences are unclear, and why? I’ll rewrite them myself."],
] as const;

function TuteeHome({ requestedRole }: { requestedRole: "tutor" | "director" | null }) {
  return (
    <div className="space-y-10 pt-10">
      {requestedRole && (
        <p role="status" className="rounded-lg border border-gold-300/70 bg-gold-50 px-5 py-4 text-stone-800">
          Your {requestedRole} request is waiting for the director.
        </p>
      )}
      <section className="max-w-2xl space-y-3">
        <h2 className="font-display text-2xl font-semibold text-ink">AI works best as a writing coach</h2>
        <p className="text-stone-700">
          Your professors grade your thinking and your voice. If AI writes the draft, you skip the practice that makes the next paper easier. Ask it to question, explain and quiz you, and keep the writing yours.
        </p>
      </section>

      <section aria-labelledby="swap">
        <h2 id="swap" className="mb-3 font-display text-2xl font-semibold text-ink">Swap the request</h2>
        <ul className="space-y-3">
          {ASK_INSTEAD.map(([bad, good]) => (
            <li key={bad} className="grid overflow-hidden rounded-lg border border-stone-200 bg-white sm:grid-cols-2">
              <div className="border-b border-stone-200 bg-red-50/60 p-4 sm:border-b-0 sm:border-r">
                <p className="text-sm font-semibold text-margin">Instead of</p>
                <p className="mt-1 text-stone-800 line-through decoration-margin/50">{bad}</p>
              </div>
              <div className="p-4">
                <p className="text-sm font-semibold text-indigo-700">Ask</p>
                <p className="mt-1 text-stone-900">{good}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-gold-300/70 bg-gold-50 p-6">
        <h2 className="font-display text-2xl font-semibold text-ink">Talk to a person too</h2>
        <p className="mt-1 max-w-xl text-stone-700">
          Tutors at the Reading/Writing Center can work through a draft with you at any stage. After a session your tutor may send you next steps and prompts to use with AI.
        </p>
      </section>
    </div>
  );
}

export default async function Home() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!user.onboarded) redirect("/welcome");
  const first = (user.name || user.email).split(/[ @]/)[0];
  return (
    <>
      <Hero role={user.role} name={first} />
      {user.role === "tutee" ? <TuteeHome requestedRole={user.requestedRole} /> : <StaffHome role={user.role} userId={user.id} />}
    </>
  );
}
