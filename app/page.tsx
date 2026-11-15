import Link from "next/link";
import { redirect } from "next/navigation";
import { Chip, Empty } from "@/components/ui";
import { fmtDate } from "@/components/format";
import { getUser, type Role } from "@/lib/auth";
import { listSessions } from "@/lib/sessions";

export const dynamic = "force-dynamic";

const TOOLS = [
  ["/history", "History", "Past sessions, your reflections and quiz scores."],
  ["/search", "ARIA search", "Describe what you need and find the right ARIA file."],
  ["/taskforce", "Task force", "Turn an assignment into steps, an outline and questions."],
  ["/practice", "Practice", "Role-play a tricky student, or take a 5-question refresher."],
  ["/reading", "Reading", "Articles and books to keep growing as a tutor."],
] as const;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function Hero({ role, name }: { role: Role; name: string }) {
  const line = {
    director: "Keep the tutor list current, then see how sessions are going.",
    tutor: "Write up your last session, or sharpen a skill before the next one.",
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
  const recent = listSessions(userId).slice(0, 3);
  return (
    <div className="space-y-10 pt-10">
      <Link href="/session" className="group flex flex-wrap items-center justify-between gap-4 rounded-lg bg-ink p-6 text-white transition hover:bg-indigo-800 sm:p-8">
        <div className="max-w-lg">
          <h2 className="font-display text-3xl font-semibold">After session</h2>
          <p className="mt-1.5 text-indigo-100">Paste your notes. Get a follow-up email, printable next steps and AI prompts that coach the student instead of writing for them.</p>
        </div>
        <span className="rounded-md bg-gold-300 px-4 py-2.5 text-sm font-bold text-ink transition group-hover:bg-gold-400">Write up a session</span>
      </Link>

      {role === "director" && (
        <Link href="/admin/tutors" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold-300 bg-gold-50 p-5 transition hover:border-gold-400">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">Tutor list</h2>
            <p className="text-sm text-stone-700">Add this semester’s tutors and deactivate those who have left.</p>
          </div>
          <span className="text-sm font-semibold text-ink underline underline-offset-4">Manage tutors</span>
        </Link>
      )}

      <section aria-labelledby="recent">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="recent" className="font-display text-2xl font-semibold text-ink">Recent sessions</h2>
          <Link href="/history" className="inline-flex min-h-10 items-center text-sm font-medium text-indigo-700 underline underline-offset-4">All history</Link>
        </div>
        {recent.length === 0 ? (
          <Empty title="No sessions yet">Write one up after your next appointment and it will show here.</Empty>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
            {recent.map((s) => (
              <li key={s.id}>
                <Link href={`/session/${s.id}`} className="flex flex-wrap items-baseline justify-between gap-x-4 px-5 py-3.5 hover:bg-stone-50">
                  <span className="font-semibold text-ink">{s.student_name || "Student"} <span className="font-normal text-stone-600">in {s.course || "no course"}</span></span>
                  <span className="shrink-0 text-sm text-stone-600">{fmtDate(s.created_at)}{s.reflection ? "" : " · no reflection yet"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="tools">
        <h2 id="tools" className="mb-3 font-display text-2xl font-semibold text-ink">Tools</h2>
        <ul className="grid gap-x-8 sm:grid-cols-2">
          {TOOLS.map(([href, title, text]) => (
            <li key={href} className="border-t border-stone-200">
              <Link href={href} className="group block py-4">
                <span className="font-semibold text-ink group-hover:underline group-hover:decoration-gold-400 group-hover:decoration-2 group-hover:underline-offset-4">{title}</span>
                <span className="mt-0.5 block text-sm text-stone-600">{text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
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
