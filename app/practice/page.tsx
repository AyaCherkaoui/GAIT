"use client";
import { useEffect, useRef, useState } from "react";
import { Card, Empty, ErrorBox, Loading, PageHeader, Working, btn2Cls, btnCls, inputCls, labelCls } from "@/components/ui";
import { get, post } from "@/lib/client";
import { QUIZ_TOPICS, SCENARIOS } from "@/lib/scenarios";
import type { Feedback, QuizQuestion, QuizResult, Turn } from "@/lib/types";

type Mode = "roleplay" | "quiz";

function RolePlay({ toQuiz }: { toQuiz: () => void }) {
  const [scenario, setScenario] = useState<string>(SCENARIOS[0].id);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: "nearest" }); }, [turns.length, feedback]);

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
  const tryNext = feedback?.tryNext?.slice(0, 1) ?? [];
  return (
    <Card title="Role-play a session">
      <p className="max-w-prose text-sm text-stone-600">Pick a tricky student, talk it through, then get feedback on what you did.</p>
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
            <button className={`${btn2Cls} min-h-11`} disabled={loading} onClick={() => { setTurns([]); setFeedback(null); setError(null); }}>Start over</button>
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
            <div ref={endRef} />
          </ol>
        )}
        {loading && <Working label={started ? "Writing the student's reply or your feedback" : "Starting the role-play"} />}
        <ErrorBox error={error} />
        {started && !feedback && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim() || loading) return;
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
          <div className="space-y-4 border-t border-stone-200 pt-5">
            <div className="grid gap-4 md:grid-cols-2">
              {([
                ["What worked", feedback.worked ?? [], "border-gold-300/70 bg-gold-50"],
                ["One thing to try next time", tryNext, "border-stone-200 bg-white"],
              ] as const).filter(([, items]) => items.length > 0).map(([title, items, tone]) => (
                <section key={title} className={`rounded-lg border p-4 ${tone}`}>
                  <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px]">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </section>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={`${btnCls} min-h-11`} onClick={() => { setTurns([]); setFeedback(null); }}>Try another role-play</button>
              <button className={`${btn2Cls} min-h-11`} onClick={toQuiz}>Take the refresher quiz</button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function Quiz({ onSaved }: { onSaved: () => void }) {
  const [topic, setTopic] = useState<string>(QUIZ_TOPICS[0]);
  const [full, setFull] = useState<QuizQuestion[] | null>(null);
  const [set, setSet] = useState<QuizQuestion[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const r = await post<{ questions: QuizQuestion[] }>("/api/practice", { action: "quiz", topic });
      setFull(r.questions);
      setSet(r.questions);
      setIdx(0);
      setPicked({});
      setFinished(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const retrying = !!full && !!set && set !== full;
  async function finish() {
    setFinished(true);
    if (!retrying && set) {
      const score = set.filter((q, i) => picked[i] === q.answer).length;
      await post("/api/practice", { action: "saveQuiz", topic, score, total: set.length }).then(onSaved).catch(() => {});
    }
  }
  function retryMissed() {
    if (!set) return;
    setSet(set.filter((q, i) => picked[i] !== q.answer));
    setIdx(0);
    setPicked({});
    setFinished(false);
  }

  const q = set && !finished ? set[idx] : null;
  const answered = picked[idx] !== undefined;
  const score = set ? set.filter((x, i) => picked[i] === x.answer).length : 0;
  const missed = set ? set.filter((x, i) => picked[i] !== x.answer) : [];

  return (
    <Card title="Refresher quiz">
      <p className="max-w-prose text-sm text-stone-600">Five questions on one topic. You see why after each answer.</p>
      <div className="mt-4 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="quiz-topic" className={labelCls}>Quiz topic</label>
            <select id="quiz-topic" className={`${inputCls} min-h-11`} value={topic} onChange={(e) => setTopic(e.target.value)}>
              {QUIZ_TOPICS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <button className={`${btnCls} min-h-11`} disabled={loading} onClick={start}>{set ? "Start a new quiz" : "Start quiz"}</button>
        </div>
        {loading && <Working label="Writing your quiz" />}
        <ErrorBox error={error} />
        {q && set && (
          <div className="border-t border-stone-200 pt-5">
            <p className="text-sm font-semibold text-stone-700">{retrying ? "Missed question " : "Question "}{idx + 1} of {set.length}</p>
            <div className="mt-1.5 h-2 rounded-full bg-stone-200" role="progressbar" aria-valuemin={0} aria-valuemax={set.length} aria-valuenow={idx + (answered ? 1 : 0)} aria-label="Quiz progress">
              <div className="h-2 rounded-full bg-gold-400 transition-all" style={{ width: `${((idx + (answered ? 1 : 0)) / set.length) * 100}%` }} />
            </div>
            <p id="quiz-q" className="mt-4 max-w-prose text-base font-semibold text-stone-900">{q.q}</p>
            <div role="group" aria-labelledby="quiz-q" className="mt-3 space-y-2">
              {q.choices.map((c, j) => {
                const chosen = picked[idx] === j;
                const correct = answered && j === q.answer;
                const wrong = answered && chosen && j !== q.answer;
                const style = correct ? "border-2 border-green-700 bg-green-50" : wrong ? "border-2 border-margin bg-red-50" : "border border-stone-300 bg-white hover:border-ink hover:bg-stone-50";
                return (
                  <button key={j} disabled={answered} aria-pressed={chosen} onClick={() => setPicked({ ...picked, [idx]: j })} className={`flex min-h-12 w-full items-center gap-3 rounded-md px-4 py-2.5 text-left text-[15px] disabled:cursor-default ${style}`}>
                    <span aria-hidden className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${correct ? "border-green-700 bg-green-700 text-white" : wrong ? "border-margin bg-margin text-white" : "border-stone-400"}`}>{correct ? "✓" : wrong ? "✕" : ""}</span>
                    <span className="min-w-0 flex-1 break-words">{c}</span>
                    {correct && <span className="shrink-0 text-sm font-semibold text-green-800">{chosen ? "Correct" : "Right answer"}</span>}
                    {wrong && <span className="shrink-0 text-sm font-semibold text-red-800">Not quite</span>}
                  </button>
                );
              })}
            </div>
            {answered && (
              <div className="mt-3 space-y-3">
                <p className="max-w-prose rounded-md border border-gold-300/70 bg-gold-50 px-4 py-2.5 text-sm text-stone-800">{q.why}</p>
                {idx + 1 < set.length ? (
                  <button className={`${btnCls} min-h-11`} onClick={() => setIdx(idx + 1)}>Next question</button>
                ) : (
                  <button className={`${btnCls} min-h-11`} onClick={finish}>See my score</button>
                )}
              </div>
            )}
          </div>
        )}
        {finished && set && (
          <div className="space-y-3 border-t border-stone-200 pt-5">
            <p className="rounded-md bg-ink px-4 py-3 font-display text-lg font-semibold text-white">Your score: <span className="text-gold-300">{score} of {set.length}</span></p>
            {retrying && <p className="text-sm text-stone-600">This was a practice round on the questions you missed, so it is not added to your score history.</p>}
            <div className="flex flex-wrap gap-2">
              {missed.length > 0 && <button className={`${btnCls} min-h-11`} onClick={retryMissed}>Try the ones you missed</button>}
              <button className={`${btn2Cls} min-h-11`} disabled={loading} onClick={start}>Start a new quiz</button>
            </div>
          </div>
        )}
        {!set && !loading && <Empty title="No quiz yet">Choose a topic and select Start quiz.</Empty>}
      </div>
    </Card>
  );
}

function History({ refresh }: { refresh: number }) {
  const [results, setResults] = useState<QuizResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setError(null);
    get<{ results: QuizResult[] }>("/api/practice/results").then((j) => setResults(j.results)).catch((e) => setError((e as Error).message));
  }, [refresh]);
  if (error) return <ErrorBox error={error} />;
  if (results === null) return <Loading />;
  const pct = (r: QuizResult) => (r.total ? r.score / r.total : 0);
  const avg = (rs: QuizResult[]) => rs.reduce((a, r) => a + pct(r), 0) / rs.length;
  // results are newest first: compare the latest 3 with the 3 before them.
  let trend = "Take another quiz to see a trend.";
  if (results.length >= 2) {
    const recent = results.slice(0, 3), before = results.slice(3, 6);
    const diff = before.length ? avg(recent) - avg(before) : pct(results[0]) - pct(results[1]);
    trend = diff > 0.05 ? "Trending up. Nice work." : diff < -0.05 ? "Trending down. A refresher on the missed topics may help." : "Holding steady.";
  }
  return (
    <Card title="Your quiz scores">
      {results.length === 0 ? (
        <Empty title="No scores yet">Finish a refresher quiz and your score will show up here.</Empty>
      ) : (
        <div className="space-y-3">
          <p className="text-[15px] font-medium text-stone-800">{trend}</p>
          <ul className="space-y-2">
            {results.slice(0, 8).map((r) => (
              <li key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-sm">
                <span className="min-w-0 break-words text-stone-800">{r.topic} <span className="text-stone-600">· {r.created_at.slice(0, 10)}</span></span>
                <span className="font-semibold text-ink">{r.score} of {r.total}</span>
                <span className="col-span-2 h-2 rounded-full bg-stone-200" aria-hidden><span className="block h-2 rounded-full bg-gold-400" style={{ width: `${Math.round(pct(r) * 100)}%` }} /></span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export default function PracticePage() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [refresh, setRefresh] = useState(0);
  const pick = (m: Mode, title: string, text: string) => (
    <button type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`min-h-11 rounded-lg border p-4 text-left transition ${mode === m ? "border-2 border-ink bg-gold-50" : "border-stone-200 bg-white hover:border-ink"}`}>
      <span className="block font-display text-lg font-semibold text-ink">{title}</span>
      <span className="mt-0.5 block text-sm text-stone-600">{text}</span>
    </button>
  );
  return (
    <div className="space-y-6">
      <PageHeader title="Practice">No appointment right now? Sharpen your tutoring in 10 minutes.</PageHeader>
      <div role="group" aria-label="Practice mode" className="grid gap-3 sm:grid-cols-2">
        {pick("roleplay", "Role-play a session", "Talk with a tricky student, then get feedback.")}
        {pick("quiz", "5-question refresher", "Quick questions on one topic, with reasons.")}
      </div>
      {mode === null && <Empty title="Pick a way to practice">Choose role-play or the refresher quiz above.</Empty>}
      {mode === "roleplay" && <RolePlay toQuiz={() => setMode("quiz")} />}
      {mode === "quiz" && <Quiz onSaved={() => setRefresh((n) => n + 1)} />}
      <History refresh={refresh} />
    </div>
  );
}
