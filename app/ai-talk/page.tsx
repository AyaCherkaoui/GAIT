"use client";
import { useState } from "react";
import CopyButton from "@/components/CopyButton";
import VoiceToggle, { useVoiceFirst } from "@/components/VoiceToggle";
import { Card, ErrorBox, btnCls, inputCls } from "@/components/ui";
import { post } from "@/lib/client";
import { TALK_SCENARIOS } from "@/lib/ai-talk";

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="font-medium">{title}</p>
      <ul className="list-disc space-y-1 pl-5">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

function Scripts() {
  const [id, setId] = useState(TALK_SCENARIOS[0].id);
  const [context, setContext] = useState("");
  const [tailored, setTailored] = useState<{ openers: string[]; steps: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = TALK_SCENARIOS.find((x) => x.id === id)!;

  function pick(next: string) {
    setId(next);
    setTailored(null);
    post("/api/ai-talk", { action: "used" }).catch(() => {});
  }

  async function tailor() {
    setLoading(true);
    setError(null);
    try {
      setTailored(await post<{ openers: string[]; steps: string[] }>("/api/ai-talk", { action: "tailor", scenario: id, context }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <select className={inputCls} value={id} onChange={(e) => pick(e.target.value)}>
        {TALK_SCENARIOS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
      </select>
      <Card title={s.label}>
        <div className="space-y-3 text-sm">
          <p className="text-slate-600">{s.intro}</p>
          <List title="Openers" items={s.openers} />
          <List title="Follow-ups" items={s.followUps} />
          <List title="What not to say" items={s.dontSay} />
          <List title="Steer back to coaching" items={s.steerBack} />
        </div>
      </Card>
      <Card title="Tailor the wording (needs a model key)">
        <div className="space-y-2 text-sm">
          <textarea className={inputCls} rows={3} placeholder="Optional context: course, what the student said, how the session is going (no full names)" value={context} onChange={(e) => setContext(e.target.value)} />
          <button className={btnCls} disabled={loading} onClick={tailor}>{loading ? "Thinking…" : "Tailor it"}</button>
          <ErrorBox error={error} />
          {tailored && (
            <div className="space-y-2">
              <List title="Tailored openers" items={tailored.openers} />
              <List title="Next moves" items={tailored.steps} />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function Ownership() {
  const [text, setText] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [voice, setVoice] = useVoiceFirst();
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await post<{ questions: string[] }>("/api/ai-talk", { action: "ownership", text, discipline, voice });
      setQuestions(r.questions);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title="Ownership questions">
      <form onSubmit={go} className="space-y-3 text-sm">
        <p className="text-slate-600">Paste a paragraph. You get questions only, which help the writer explain their claim, evidence and word choices. The text is not saved.</p>
        <textarea className={inputCls} rows={6} placeholder="Paste one paragraph" value={text} onChange={(e) => setText(e.target.value)} />
        <input className={inputCls} placeholder="Discipline (optional, e.g. history, biology)" value={discipline} onChange={(e) => setDiscipline(e.target.value)} />
        <VoiceToggle on={voice} set={setVoice} />
        <button className={btnCls} disabled={loading}>{loading ? "Thinking…" : "Get questions"}</button>
      </form>
      <div className="mt-3"><ErrorBox error={error} /></div>
      {questions && (
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
          {questions.map((q, i) => (
            <li key={i}><span className="mr-2">{q}</span><CopyButton text={q} /></li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export default function AiTalkPage() {
  const [tab, setTab] = useState<"scripts" | "ownership">("scripts");
  const tabCls = (t: string) => `rounded px-3 py-1 text-sm ${tab === t ? "bg-indigo-600 text-white" : "border border-slate-300"}`;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Talking about AI</h1>
        <p className="text-sm text-slate-600">Curious, never accusing. GAIT does not detect AI and does not judge who wrote a text.</p>
      </div>
      <div className="flex gap-2">
        <button className={tabCls("scripts")} onClick={() => setTab("scripts")}>Script bank</button>
        <button className={tabCls("ownership")} onClick={() => setTab("ownership")}>Ownership questions</button>
      </div>
      {tab === "scripts" ? <Scripts /> : <Ownership />}
    </div>
  );
}
