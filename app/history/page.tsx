"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Empty, PageHeader } from "@/components/ui";
import { get } from "@/lib/client";
import type { QuizResult, SessionSummary } from "@/lib/types";

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [quizzes, setQuizzes] = useState<QuizResult[]>([]);
  useEffect(() => {
    get<{ sessions: SessionSummary[] }>("/api/session").then((j) => setSessions(j.sessions)).catch(() => setSessions([]));
    get<{ results: QuizResult[] }>("/api/practice/results").then((j) => setQuizzes(j.results)).catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader title="History">Your past sessions, your reflections, and your quiz scores.</PageHeader>

      <section aria-labelledby="h-sessions" className="space-y-3">
        <h2 id="h-sessions" className="font-display text-2xl font-semibold text-ink">Sessions</h2>
        {sessions === null && <p className="text-sm text-stone-600">Loading…</p>}
        {sessions?.length === 0 && (
          <Empty title="No sessions yet">Write one up on the <Link className="font-medium text-indigo-700 underline underline-offset-4" href="/session">After session</Link> page and it will show here.</Empty>
        )}
        {sessions && sessions.length > 0 && (
          <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link className="block min-h-10 px-5 py-3.5 hover:bg-stone-50" href={`/session/${s.id}`}>
                  <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <span className="font-semibold text-ink">{s.student_name || "Student"} <span className="font-normal text-stone-600">in {s.course || "no course"}</span></span>
                    <span className="text-sm text-stone-500">{s.created_at}</span>
                  </span>
                  {s.reflection ? (
                    <span className="mt-1 block max-w-prose text-sm text-stone-600">
                      {s.reflection.goalNextTime ? `Goal next time: ${s.reflection.goalNextTime}` : s.reflection.learned ? `Learned: ${s.reflection.learned}` : "Reflection saved."}
                    </span>
                  ) : (
                    <span className="mt-1 block text-sm text-stone-500">No reflection yet</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
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
                <span className="text-stone-500">{q.created_at}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
