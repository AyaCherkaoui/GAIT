"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, PageHeader } from "@/components/ui";
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
    <div className="space-y-6">
      <PageHeader title="History">Your past sessions, your reflections, and your quiz scores.</PageHeader>
      <Card title="Sessions">
        {sessions === null && <p className="text-sm text-stone-500">Loading…</p>}
        {sessions?.length === 0 && <p className="text-sm text-stone-500">No sessions yet. Write one up on the After session page.</p>}
        <ul className="divide-y divide-stone-100 text-sm">
          {sessions?.map((s) => (
            <li key={s.id} className="py-2">
              <Link className="font-medium text-indigo-700 hover:underline" href={`/session/${s.id}`}>
                {s.student_name || "Student"} · {s.course || "no course"}
              </Link>
              <span className="text-stone-500"> · {s.created_at}</span>
              {s.reflection ? (
                <p className="mt-1 text-stone-600">
                  {s.reflection.goalNextTime ? `Goal next time: ${s.reflection.goalNextTime}` : s.reflection.learned ? `Learned: ${s.reflection.learned}` : "Reflection saved."}
                </p>
              ) : (
                <p className="mt-1 text-stone-400">No reflection yet</p>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Quiz scores">
        {quizzes.length === 0 && <p className="text-sm text-stone-500">No quizzes taken yet.</p>}
        <ul className="space-y-1 text-sm">
          {quizzes.map((q) => (
            <li key={q.id}>{q.score}/{q.total} · {q.topic} <span className="text-stone-500">· {q.created_at}</span></li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
