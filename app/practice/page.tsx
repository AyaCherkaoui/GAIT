"use client";
import { useState } from "react";
import { Card, ErrorBox, btnCls, inputCls } from "@/components/ui";
import { post } from "@/lib/client";
import { QUIZ_TOPICS, SCENARIOS } from "@/lib/scenarios";
import type { Feedback, QuizQuestion, Turn } from "@/lib/types";

function RolePlay() {
  const [scenario, setScenario] = useState<string>(SCENARIOS[0].id);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function studentReply(next: Turn[]) {
    setLoading(true);
    setError(null);
    try {
      const { reply } = await post<{ reply: string }>("/api/practice", { action: "roleplay", scenario, turns: next });
      setTurns([...next, { role: "student", text: reply }]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function end() {
    setLoading(true);
    setError(null);
    try {
      const r = await post<{ feedback: Feedback }>("/api/practice", { action: "feedback", scenario, turns });
      setFeedback(r.feedback);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const started = turns.length > 0;
  return (
    <Card title="Role-play a session">
      <div className="space-y-3 text-sm">
        <div className="flex gap-2">
          <select className={inputCls} value={scenario} disabled={started} onChange={(e) => setScenario(e.target.value)}>
            {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {!started ? (
            <button className={btnCls} disabled={loading} onClick={() => studentReply([])}>{loading ? "…" : "Start"}</button>
          ) : (
            <button className="rounded border px-3 text-sm" onClick={() => { setTurns([]); setFeedback(null); }}>Reset</button>
          )}
        </div>
        <div className="space-y-2">
          {turns.map((t, i) => (
            <p key={i} className={t.role === "student" ? "rounded bg-amber-50 p-2" : "rounded bg-indigo-50 p-2 text-right"}>
              <span className="font-medium">{t.role === "student" ? "Student" : "You"}:</span> {t.text}
            </p>
          ))}
        </div>
        {started && !feedback && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim()) return;
              const next: Turn[] = [...turns, { role: "tutor", text: draft.trim() }];
              setTurns(next);
              setDraft("");
              studentReply(next);
            }}
          >
            <input className={inputCls} placeholder="What do you say?" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button className={btnCls} disabled={loading}>Send</button>
            <button type="button" className="rounded border px-3 text-sm" disabled={loading} onClick={end}>End &amp; get feedback</button>
          </form>
        )}
        <ErrorBox error={error} />
        {feedback && (
          <div className="space-y-2">
            <p className="font-medium">What worked</p>
            <ul className="list-disc pl-5">{feedback.worked.map((x, i) => <li key={i}>{x}</li>)}</ul>
            <p className="font-medium">What you missed</p>
            <ul className="list-disc pl-5">{feedback.missed.map((x, i) => <li key={i}>{x}</li>)}</ul>
            <p className="font-medium">Try next time</p>
            <ul className="list-disc pl-5">{feedback.tryNext.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        )}
      </div>
    </Card>
  );
}

function Quiz() {
  const [topic, setTopic] = useState<string>(QUIZ_TOPICS[0]);
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    setPicked({});
    try {
      const r = await post<{ questions: QuizQuestion[] }>("/api/practice", { action: "quiz", topic });
      setQuestions(r.questions);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const score = questions ? questions.filter((q, i) => picked[i] === q.answer).length : 0;
  return (
    <Card title="Refresher quiz">
      <div className="space-y-3 text-sm">
        <div className="flex gap-2">
          <select className={inputCls} value={topic} onChange={(e) => setTopic(e.target.value)}>
            {QUIZ_TOPICS.map((t) => <option key={t}>{t}</option>)}
          </select>
          <button className={btnCls} disabled={loading} onClick={start}>{loading ? "…" : "New quiz"}</button>
        </div>
        <ErrorBox error={error} />
        {questions?.map((q, i) => (
          <div key={i} className="space-y-1">
            <p className="font-medium">{i + 1}. {q.q}</p>
            {q.choices.map((c, j) => {
              const chosen = picked[i] === j;
              const answered = picked[i] !== undefined;
              const color = answered && j === q.answer ? "bg-green-50 border-green-300" : chosen ? "bg-red-50 border-red-300" : "border-slate-200";
              return (
                <button key={j} disabled={answered} onClick={() => setPicked({ ...picked, [i]: j })} className={`block w-full rounded border p-2 text-left ${color}`}>
                  {c}
                </button>
              );
            })}
            {picked[i] !== undefined && <p className="text-slate-600">{q.why}</p>}
          </div>
        ))}
        {questions && Object.keys(picked).length === questions.length && <p className="font-medium">Score: {score}/{questions.length}</p>}
      </div>
    </Card>
  );
}

export default function PracticePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Practice</h1>
        <p className="text-sm text-slate-600">No appointment right now? Sharpen your tutoring in 10 minutes.</p>
      </div>
      <RolePlay />
      <Quiz />
    </div>
  );
}
