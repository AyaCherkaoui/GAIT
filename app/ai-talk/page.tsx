"use client";
import { useState } from "react";
import CopyButton from "@/components/CopyButton";
import { Card, Chip, ErrorBox, PageHeader, Working, btnCls, inputCls, labelCls, submitOnCmdEnter } from "@/components/ui";
import { post } from "@/lib/client";
import { TALK_SCENARIOS } from "@/lib/ai-talk";

function List({ title, items, copy }: { title: string; items: string[]; copy?: boolean }) {
  return (
    <section>
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      <ul className="mt-1.5 max-w-prose space-y-2 text-[15px]">
        {items.map((x, i) => (
          <li key={i} className="flex items-start justify-between gap-3 rounded-md border border-stone-200 bg-white px-3 py-2">
            <span className="min-w-0 break-words">{x}</span>
            {copy && <span className="shrink-0"><CopyButton text={x} /></span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Scripts() {
  const [id, setId] = useState(TALK_SCENARIOS[0].id);
  const [context, setContext] = useState("");
  const [tailored, setTailored] = useState<{ openers: string[]; steps: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = TALK_SCENARIOS.find((x) => x.id === id)!;

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
    <div className="space-y-5">
      <div className="max-w-xl">
        <label htmlFor="talk-scenario" className={labelCls}>The situation</label>
        <select id="talk-scenario" className={`${inputCls} min-h-11`} value={id} onChange={(e) => { setId(e.target.value); setTailored(null); }}>
          {TALK_SCENARIOS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </div>
      <Card title={s.label}>
        <div className="space-y-5">
          <p className="max-w-prose text-[15px] text-stone-700">{s.intro}</p>
          <List title="Openers" items={s.openers} copy />
          <List title="Follow-ups" items={s.followUps} copy />
          <List title="What not to say" items={s.dontSay} />
          <List title="Steer back to coaching" items={s.steerBack} copy />
        </div>
      </Card>
      <Card title="Tailor the wording">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); tailor(); }}>
          <div>
            <label htmlFor="talk-context" className={labelCls}>Context (optional)</label>
            <textarea id="talk-context" className={`${inputCls} ruled`} rows={3} placeholder="Course, what the student said, how the session is going. No full names." value={context} onChange={(e) => setContext(e.target.value)} onKeyDown={submitOnCmdEnter} />
          </div>
          <button className={`${btnCls} min-h-11`} disabled={loading}>Tailor it</button>
          {loading && <Working label="Tailoring the wording" />}
          <ErrorBox error={error} />
          {tailored && (
            <div className="space-y-4 pt-2">
              <List title="Tailored openers" items={tailored.openers} copy />
              <List title="Next moves" items={tailored.steps} copy />
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}

function Ownership() {
  const [text, setText] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await post<{ questions: string[] }>("/api/ai-talk", { action: "ownership", text, discipline });
      setQuestions(r.questions);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title="Ownership questions">
      <form onSubmit={go} className="space-y-4">
        <p className="max-w-prose text-[15px] text-stone-700">Paste a paragraph. You get questions only, which help the writer explain their claim, evidence and word choices. The text is not saved.</p>
        <div>
          <label htmlFor="own-text" className={labelCls}>Paragraph</label>
          <textarea id="own-text" className={`${inputCls} ruled`} rows={6} placeholder="Paste one paragraph" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={submitOnCmdEnter} />
        </div>
        <div>
          <label htmlFor="own-disc" className={labelCls}>Discipline (optional)</label>
          <input id="own-disc" className={`${inputCls} min-h-11`} placeholder="For example, history or biology" value={discipline} onChange={(e) => setDiscipline(e.target.value)} />
        </div>
        <button className={`${btnCls} min-h-11`} disabled={loading}>Get questions</button>
      </form>
      {loading && <div className="mt-4"><Working label="Writing questions" /></div>}
      <div className="mt-4"><ErrorBox error={error} /></div>
      {questions && (
        <ol className="mt-4 list-decimal space-y-3 pl-6 text-[15px] marker:font-semibold marker:text-gold-600">
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
  const tabCls = (t: string) =>
    `min-h-11 rounded-md px-4 text-sm font-semibold transition ${tab === t ? "bg-ink text-white" : "border border-stone-300 bg-white text-stone-800 hover:bg-stone-100"}`;
  return (
    <div className="space-y-6">
      <PageHeader title="AI talk">Curious, never accusing. Ink does not detect AI and does not judge who wrote a text.</PageHeader>
      <p className="text-sm text-stone-800"><Chip tone="gold">Draft: director to confirm</Chip> <span className="ml-1">These scripts are a starting point. Check them with the director before relying on them.</span></p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Tools">
        <button type="button" aria-pressed={tab === "scripts"} className={tabCls("scripts")} onClick={() => setTab("scripts")}>Script bank</button>
        <button type="button" aria-pressed={tab === "ownership"} className={tabCls("ownership")} onClick={() => setTab("ownership")}>Ownership questions</button>
      </div>
      {tab === "scripts" ? <Scripts /> : <Ownership />}
    </div>
  );
}
