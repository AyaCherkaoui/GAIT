"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Chip, Empty, ErrorBox, Loading, PageHeader, btn2Cls, btnCls, inputCls, labelCls } from "@/components/ui";
import { fmtDate } from "@/components/format";
import { get } from "@/lib/client";
import { readEmailSent } from "@/lib/local";
import type { QuizResult, SessionSummary } from "@/lib/types";

function parseDate(s: string) {
  return new Date(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(s) ? s.replace(" ", "T") + "Z" : s);
}
/** Monday of the week the session was written, as "Nov 9, 2026". */
function weekOf(s: string) {
  const d = parseDate(s);
  if (isNaN(d.getTime())) return "Earlier";
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return `Week of ${fmtDate(d.toISOString())}`;
}

function EmailSentChip({ id }: { id: number }) {
  const [sent, setSent] = useState(false);
  useEffect(() => setSent(readEmailSent(id)), [id]);
  return sent ? <Chip tone="ink">Email sent</Chip> : null;
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [quizzes, setQuizzes] = useState<QuizResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [student, setStudent] = useState("");
  const [course, setCourse] = useState("");
  useEffect(() => {
    get<{ sessions: SessionSummary[] }>("/api/session").then((j) => setSessions(j.sessions)).catch((e) => { setSessions([]); setError((e as Error).message); });
    get<{ results: QuizResult[] }>("/api/practice/results").then((j) => setQuizzes(j.results)).catch((e) => setError((e as Error).message));
  }, []);

  const students = useMemo(() => [...new Set((sessions ?? []).map((s) => s.student_name).filter(Boolean))].sort(), [sessions]);
  const courses = useMemo(() => [...new Set((sessions ?? []).map((s) => s.course).filter(Boolean))].sort(), [sessions]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (sessions ?? []).filter(
      (s) =>
        (!student || s.student_name === student) &&
        (!course || s.course === course) &&
        (!needle || `${s.student_name} ${s.course} ${s.reflection?.goalNextTime ?? ""} ${s.reflection?.learned ?? ""}`.toLowerCase().includes(needle)),
    );
  }, [sessions, q, student, course]);
  const weeks = useMemo(() => {
    const m = new Map<string, SessionSummary[]>();
    for (const s of shown) m.set(weekOf(s.created_at), [...(m.get(weekOf(s.created_at)) ?? []), s]);
    return [...m.entries()];
  }, [shown]);
  const filtering = !!(q.trim() || student || course);

  return (
    <div className="space-y-8">
      <PageHeader title="History">Your past sessions, your reflections, and your quiz scores.</PageHeader>

      <section aria-labelledby="h-sessions" className="space-y-4">
        <h2 id="h-sessions" className="font-display text-2xl font-semibold text-ink">Sessions</h2>
        <ErrorBox error={error} />
        {sessions === null && <Loading />}
        {sessions?.length === 0 && (
          <Empty title="No sessions yet">
            Log one after your next appointment and it will show here.
            <span className="mt-4 flex justify-center"><Link href="/session" className={`${btnCls} min-h-10`}>Log a session</Link></span>
          </Empty>
        )}
        {sessions && sessions.length > 0 && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <label htmlFor="h-search" className={labelCls}>Search</label>
                <input id="h-search" type="search" className={inputCls} placeholder="Student, course or reflection" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <div>
                <label htmlFor="h-student" className={labelCls}>Student</label>
                <select id="h-student" className={inputCls} value={student} onChange={(e) => setStudent(e.target.value)}>
                  <option value="">All students</option>
                  {students.map((n) => <option key={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="h-course" className={labelCls}>Course</label>
                <select id="h-course" className={inputCls} value={course} onChange={(e) => setCourse(e.target.value)}>
                  <option value="">All courses</option>
                  {courses.map((n) => <option key={n}>{n}</option>)}
                </select>
              </div>
              {filtering && (
                <div className="flex items-end">
                  <button type="button" className={`${btn2Cls} min-h-10`} onClick={() => { setQ(""); setStudent(""); setCourse(""); }}>Clear filters</button>
                </div>
              )}
            </div>
            <p role="status" className="text-sm text-stone-600">{shown.length} of {sessions.length} {sessions.length === 1 ? "session" : "sessions"}</p>
            {shown.length === 0 && <Empty title="No matches">Try a different name or course, or clear the filters.</Empty>}
            {weeks.map(([week, list]) => (
              <div key={week}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-600">{week}</h3>
                <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
                  {list.map((s) => (
                    <li key={s.id}>
                      <Link className="block min-h-10 px-5 py-3.5 hover:bg-stone-50" href={`/session/${s.id}`}>
                        <span className="flex items-baseline justify-between gap-4">
                          <span className="min-w-0 font-semibold text-ink">{s.student_name || "Student"} <span className="font-normal text-stone-600">in {s.course || "no course"}</span></span>
                          <span className="shrink-0 whitespace-nowrap text-sm text-stone-600">{fmtDate(s.created_at)}</span>
                        </span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-2">
                          <Chip tone={s.reflection ? "plain" : "gold"}>{s.reflection ? "Reflection saved" : "No reflection yet"}</Chip>
                          <EmailSentChip id={s.id} />
                        </span>
                        {s.reflection && (s.reflection.goalNextTime || s.reflection.learned) && (
                          <span className="mt-1 block max-w-prose text-sm text-stone-600">
                            {s.reflection.goalNextTime ? `Goal next time: ${s.reflection.goalNextTime}` : `Learned: ${s.reflection.learned}`}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}
      </section>

      <section aria-labelledby="h-quiz" className="space-y-3 border-t border-stone-200 pt-6">
        <h2 id="h-quiz" className="font-display text-2xl font-semibold text-ink">Quiz scores</h2>
        {quizzes.length === 0 ? (
          <Empty title="No quizzes yet">Take a 5-question refresher on the <Link className="font-medium text-indigo-700 underline underline-offset-4" href="/practice">Practice</Link> page.</Empty>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white text-sm">
            {quizzes.map((q) => (
              <li key={q.id} className="flex flex-wrap items-baseline justify-between gap-x-4 px-5 py-3">
                <span><span className="font-semibold text-ink">{q.score}/{q.total}</span> <span className="text-stone-700">{q.topic}</span></span>
                <span className="shrink-0 whitespace-nowrap text-stone-600">{fmtDate(q.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
