import Link from "next/link";
import { redirect } from "next/navigation";
import { Chip, Empty } from "@/components/ui";
import SessionStarter from "@/components/SessionStarter";
import StudentHome from "@/components/StudentHome";
import MyTaskForceCard from "@/components/MyTaskForceCard";
import TaskForcePicker from "@/components/TaskForcePicker";
import { fmtDate } from "@/components/format";
import { getUser, type Role } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listSessions } from "@/lib/sessions";

export const dynamic = "force-dynamic";

const QUICK = [
  ["/search", "Search ARIA", "Find the right handout fast."],
  ["/practice", "Practice", "Role-play a tricky session."],
  ["/taskforce", "Task planner", "Turn a task into steps."],
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
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return (
    <header className="rise flex flex-col gap-2">
      <span className="text-sm text-stone-600">{today}</span>
      <h1 className="font-display text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.02] tracking-[-0.03em] text-ink">
        {greeting()}, <span className="mark">{name}</span>.
      </h1>
      <p className="text-lg text-stone-700">{line}</p>
    </header>
  );
}

const card = "rounded-xl border border-stone-200 bg-white transition hover:border-stone-300 hover:shadow-[0_2px_10px_-4px_rgba(21,23,28,0.12)]";
const h2 = "font-display text-[22px] text-ink";

function StaffHome({ role, userId }: { role: Role; userId: number }) {
  const all = listSessions(userId);
  const recent = all.slice(0, 3);
  const resume = all.find((s) => !s.reflection);
  const waiting = role === "director" ? pendingRequests() : 0;
  return (
    <div className="mt-9 space-y-9">
      {role === "director" && (
        <Link href="/admin/tutors" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold-300 bg-gold-100/70 px-5 py-4 transition hover:border-gold-400">
          <p className="text-ink">
            <span className="font-semibold">{waiting === 0 ? "No requests waiting" : `${waiting} tutor ${waiting === 1 ? "request" : "requests"}`}</span>
            {waiting === 0 ? ". Manage the tutor list." : " waiting for your approval."}
          </p>
          <span className="text-sm font-semibold text-ink underline underline-offset-4">Open tutor list</span>
        </Link>
      )}

      {role !== "tutee" && <SessionStarter />}

      <div className="grid gap-6 sm:grid-cols-2">
        <section aria-labelledby="resume" className="flex flex-col gap-3">
          <h2 id="resume" className={h2}>Pick up where you left off</h2>
          {resume ? (
            <Link href={`/session/${resume.id}`} className={`${card} flex flex-1 flex-col gap-1.5 p-5`}>
              <span className="text-base font-semibold text-ink">{resume.student_name || "Student"} · {resume.course || "no course"}</span>
              <span className="text-sm text-stone-600">{resume.focus || "Session"} · {fmtDate(resume.created_at)}</span>
              <span className="mt-1.5"><Chip tone="gold">Reflection missing</Chip></span>
            </Link>
          ) : (
            <p className={`${card} flex-1 p-5 text-stone-600`}>Nothing waiting. Every session has its reflection.</p>
          )}
        </section>
        <section aria-labelledby="tip" className="flex flex-col gap-3">
          <h2 id="tip" className={h2}>Tip of the day</h2>
          <blockquote className="pad flex-1 rounded-xl border border-stone-200 p-5 pl-[4.25rem] text-[17px] leading-[1.9rem] text-ink">{tipOfTheDay()}</blockquote>
        </section>
      </div>

      {role === "tutor" && <MyTaskForceCard userId={userId} />}
      {role === "tutor" && (
        <section aria-labelledby="my-task-force" className="flex flex-col gap-3">
          <h2 id="my-task-force" className={h2}>Task forces</h2>
          <TaskForcePicker />
        </section>
      )}

      <section aria-labelledby="recent" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="recent" className={h2}>Recent sessions</h2>
          <Link href="/history" className="inline-flex min-h-10 items-center text-sm font-medium text-indigo-600 underline">All history</Link>
        </div>
        {recent.length === 0 ? (
          <Empty title="No sessions yet">Start with “Log a session” after your next appointment. It will show here.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="w-full min-w-[520px] border-collapse text-[15px]">
              <thead>
                <tr className="text-left text-[13px] text-stone-600">
                  <th className="border-b border-stone-200 px-5 py-3 font-medium">Student</th>
                  <th className="border-b border-stone-200 px-5 py-3 font-medium">Course</th>
                  <th className="border-b border-stone-200 px-5 py-3 font-medium">Focus</th>
                  <th className="border-b border-stone-200 px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id} className="transition hover:bg-stone-50">
                    <td className="border-b border-stone-100 px-5 py-3.5 font-semibold"><Link href={`/session/${s.id}`} className="text-ink hover:underline">{s.student_name || "Student"}</Link></td>
                    <td className="border-b border-stone-100 px-5 py-3.5">{s.course || "—"}</td>
                    <td className="border-b border-stone-100 px-5 py-3.5">{s.focus || "—"}</td>
                    <td className="border-b border-stone-100 px-5 py-3.5 text-stone-600">{fmtDate(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="quick" className="flex flex-col gap-3">
        <h2 id="quick" className={h2}>Between sessions</h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {QUICK.map(([href, title, text]) => (
            <li key={href}>
              <Link href={href} className={`${card} block h-full px-5 py-4`}>
                <span className="block font-semibold text-ink">{title}</span>
                <span className="mt-0.5 block text-sm text-stone-600">{text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default async function Home() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!user.onboarded) redirect("/welcome");
  const first = user.name?.trim().split(/\s+/)[0] || user.email.split("@")[0];
  return (
    <>
      <Hero role={user.role} name={first} />
      {user.role === "tutee" ? <StudentHome requestedRole={user.requestedRole} /> : <StaffHome role={user.role} userId={user.id} />}
    </>
  );
}
