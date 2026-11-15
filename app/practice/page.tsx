"use client";
import { useEffect, useState } from "react";
import { Empty, ErrorBox, PageHeader, Working, btn2Cls, btnCls, inputCls, labelCls } from "@/components/ui";
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
    <section className="rounded-lg border border-stone-200 bg-white p-5 sm:p-6">
      <h2 className="font-display text-2xl font-semibold text-ink">Role-play a session</h2>
      <p className="mt-1 max-w-prose text-sm text-stone-600">Pick a tricky student, talk it through, then get feedback on what you did.</p>
      <div className="mt-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="rp-scenario" className={labelCls}>Student scenario</label>
            <select id="rp-scenario" className={`${inputCls} min-h-11`} value={scenario} disabled={started} onChange={(e) => setScenario(e.target.value)}>
              {SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          {!started ? (
            <button className={`${btnCls} min-h-11`} disabled={loading} onClick={() => studentReply([])}>Start role-play</button>
          ) : (
            <button className={`${btn2Cls} min-h-11`} onClick={() => { setTurns([]); setFeedback(null); }}>Start over</button>
          )}
        </div>
        {started && (
          <ol aria-label="Conversation" className="space-y-3 rounded-md bg-stone-50 p-3 sm:p-4">
            {turns.map((t, i) => {
              const student = t.role === "student";
              return (
                <li key={i} className={`flex ${student ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[85%] rounded-lg px-4 py-2.5 text-[15px] ${student ? "border border-stone-200 bg-white text-stone-900" : "bg-ink text-white"}`}>
                    <p className={`mb-0.5 text-xs font-semibold ${student ? "text-stone-600" : "text-gold-300"}`}>{student ? "Student" : "You"}</p>
                    <p className="whitespace-pre-wrap break-words">{t.text}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {loading && <Working label={started ? "Writing the student's reply or your feedback" : "Starting the role-play"} />}
        <ErrorBox error={error} />
        {started && !feedback && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim()) return;
              const next: Turn[] = [...turns, { role: "tutor", text: draft.trim() }];
              setTurns(next);
              setDraft("");
              studentReply(next);
            }}
          >
            <div>
              <label htmlFor="rp-draft" className={labelCls}>Your reply</label>
              <input id="rp-draft" className={`${inputCls} min-h-11`} placeholder="What do you say to the student?" value={draft} onChange={(e) => setDraft(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={`${btnCls} min-h-11`} disabled={loading}>Send reply</button>
              <button type="button" className={`${btn2Cls} min-h-11`} disabled={loading} onClick={end}>End and get feedback</button>
            </div>
          </form>
        )}
        {feedback && (
          <div className="grid gap-4 border-t border-stone-200 pt-5 md:grid-cols-3">
            {([
              ["What worked", feedback.worked, "border-gold-300/70 bg-gold-50"],
              ["What you missed", feedback.missed, "border-stone-200 bg-white"],
              ["Try next time", feedback.tryNext, "border-stone-200 bg-white"],
            ] as const).map(([title, items, tone]) => (
              <section key={title} className={`rounded-lg border p-4 ${tone}`}>
                <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px]">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
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
  const done = !!questions && Object.keys(picked).length === questions.length;
  useEffect(() => {
    if (done && questions) post("/api/practice", { action: "saveQuiz", topic, score, total: questions.length }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5 sm:p-6">
      <h2 className="font-display text-2xl font-semibold text-ink">Refresher quiz</h2>
      <p className="mt-1 max-w-prose text-sm text-stone-600">Five questions on one topic. You see why after each answer.</p>
      <div className="mt-4 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="quiz-topic" className={labelCls}>Quiz topic</label>
            <select id="quiz-topic" className={`${inputCls} min-h-11`} value={topic} onChange={(e) => setTopic(e.target.value)}>
              {QUIZ_TOPICS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <button className={`${btnCls} min-h-11`} disabled={loading} onClick={start}>{questions ? "Start a new quiz" : "Start quiz"}</button>
        </div>
        {loading && <Working label="Writing your quiz" />}
        <ErrorBox error={error} />
        {questions && (
          <ol className="divide-y divide-stone-200 border-t border-stone-200">
            {questions.map((q, i) => {
              const answered = picked[i] !== undefined;
              return (
                <li key={i} className="py-5">
                  <p id={`q-${i}`} className="max-w-prose text-base font-semibold text-stone-900"><span className="mr-1.5 font-display text-ink">{i + 1}.</span>{q.q}</p>
                  <div role="group" aria-labelledby={`q-${i}`} className="mt-3 space-y-2">
                    {q.choices.map((c, j) => {
                      const chosen = picked[i] === j;
                      const correct = answered && j === q.answer;
                      const wrong = answered && chosen && j !== q.answer;
                      const style = correct ? "border-2 border-green-700 bg-green-50" : wrong ? "border-2 border-margin bg-red-50" : "border border-stone-300 bg-white hover:border-ink hover:bg-stone-50";
                      return (
                        <button key={j} disabled={answered} aria-pressed={chosen} onClick={() => setPicked({ ...picked, [i]: j })} className={`flex min-h-12 w-full items-center gap-3 rounded-md px-4 py-2.5 text-left text-[15px] disabled:cursor-default ${style}`}>
                          <span aria-hidden className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${correct ? "border-green-700 bg-green-700 text-white" : wrong ? "border-margin bg-margin text-white" : "border-stone-400"}`}>{correct ? "\u2713" : wrong ? "\u2715" : ""}</span>
                          <span className="min-w-0 flex-1 break-words">{c}</span>
                          {correct && <span className="shrink-0 text-sm font-semibold text-green-800">{chosen ? "Correct" : "Right answer"}</span>}
                          {wrong && <span className="shrink-0 text-sm font-semibold text-red-800">Not quite</span>}
                        </button>
                      );
                    })}
                  </div>
                  {answered && <p className="mt-3 max-w-prose rounded-md border border-gold-300/70 bg-gold-50 px-4 py-2.5 text-sm text-stone-800">{q.why}</p>}
                </li>
              );
            })}
          </ol>
        )}
        {questions && Object.keys(picked).length === questions.length && (
          <p className="rounded-md bg-ink px-4 py-3 font-display text-lg font-semibold text-white">Your score: <span className="text-gold-300">{score} of {questions.length}</span></p>
        )}
        {!questions && !loading && <Empty title="No quiz yet">Choose a topic and select Start quiz.</Empty>}
      </div>
    </section>
  );
}

export default function PracticePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Practice">No appointment right now? Sharpen your tutoring in 10 minutes.</PageHeader>
      <RolePlay />
      <Quiz />
    </div>
  );
}
