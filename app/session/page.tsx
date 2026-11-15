"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import SessionOutputsView from "@/components/SessionOutputs";
import { ErrorBox, PageHeader, Working, btn2Cls, btnCls, inputCls, labelCls } from "@/components/ui";
import VoiceToggle, { useVoiceFirst } from "@/components/VoiceToggle";
import { get, post } from "@/lib/client";
import { readLocal, writeLocal } from "@/lib/local";
import { AI_POLICIES, type AiPolicy, type SessionOutputs } from "@/lib/types";

const DRAFT_KEY = "ink-draft-session";
const EMPTY = { studentName: "", course: "", workedOn: "", struggles: "", wentWell: "", courseCode: "", aiUse: "", privateConcern: "" };
type Draft = typeof EMPTY;
const NEED_NOTES = "Add what you worked on or what the student struggled with.";

export default function SessionPage() {
  const [f, setF] = useState<Draft>(EMPTY);
  const [aiPolicy, setAiPolicy] = useState<AiPolicy>("unknown");
  const [voice, setVoice] = useVoiceFirst();
  const [onFile, setOnFile] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: number; outputs: SessionOutputs } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const set = (k: keyof Draft, v: string) => { setF((x) => ({ ...x, [k]: v })); if (fieldError) setFieldError(null); };

  // Notes are kept in this browser as you type, so a reload or an error never loses them.
  useEffect(() => {
    try {
      const raw = readLocal(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<Draft> & { aiPolicy?: AiPolicy };
        const next = { ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, typeof d[k as keyof Draft] === "string" ? d[k as keyof Draft] : ""])) } as Draft;
        if (Object.values(next).some((v) => v.trim())) {
          setF(next);
          if (d.aiPolicy && AI_POLICIES.includes(d.aiPolicy)) setAiPolicy(d.aiPolicy);
          setRestored(true);
        }
      }
    } catch {
      /* a broken draft is ignored */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => writeLocal(DRAFT_KEY, Object.values(f).some((v) => v.trim()) ? JSON.stringify({ ...f, aiPolicy }) : null), 300);
    return () => clearTimeout(t);
  }, [f, aiPolicy, ready]);

  function clearDraft() {
    writeLocal(DRAFT_KEY, null);
    setF(EMPTY);
    setAiPolicy("unknown");
    setOnFile(null);
    setRestored(false);
    setFieldError(null);
    setError(null);
  }

  // A policy saved for this course code (on the Policies page) fills in the choice.
  async function lookupPolicy() {
    const code = f.courseCode.trim();
    if (!code) return setOnFile(null);
    try {
      const { policy } = await get<{ policy: { course_code: string; policy: AiPolicy } | null }>(`/api/policies?code=${encodeURIComponent(code)}`);
      if (policy) setAiPolicy(policy.policy);
      setOnFile(policy ? `${policy.course_code}: ${policy.policy}` : null);
    } catch {
      setOnFile(null);
    }
  }

  async function generate(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading) return;
    setError(null);
    if (!f.workedOn.trim() && !f.struggles.trim()) {
      setFieldError(NEED_NOTES);
      document.getElementById("workedOn")?.focus();
      return;
    }
    setFieldError(null);
    setLoading(true);
    try {
      const r = await post<{ id: number; outputs: SessionOutputs }>("/api/session", {
        studentName: f.studentName, course: f.course, voice,
        notes: { workedOn: f.workedOn, struggles: f.struggles, wentWell: f.wentWell, courseCode: f.courseCode, aiPolicy, aiUse: f.aiUse, privateConcern: f.privateConcern },
      });
      setResult(r);
      writeLocal(DRAFT_KEY, null); // saved on the server now
      setRestored(false);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (err) {
      setError((err as Error).message); // the form stays filled so nothing is lost
    } finally {
      setLoading(false);
    }
  }

  const o = result?.outputs;
  const err = fieldError ? "notes-error" : undefined;
  return (
    <div className="space-y-8">
      <PageHeader title="After session">Write up your notes and get a follow-up for the student.</PageHeader>
      <form ref={formRef} onSubmit={generate} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); formRef.current?.requestSubmit(); } }} className="space-y-4 rounded-lg border border-stone-200 bg-white p-5 sm:p-6">
        {restored && (
          <p role="status" className="flex flex-wrap items-center gap-x-3 rounded-md bg-gold-50 px-3 py-2 text-sm text-stone-800">
            Draft restored.
            <button type="button" onClick={clearDraft} className="inline-flex min-h-10 items-center font-semibold text-indigo-700 underline underline-offset-4">Clear</button>
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="studentName" className={labelCls}>Student first name</label>
            <input id="studentName" className={inputCls} value={f.studentName} onChange={(e) => set("studentName", e.target.value)} />
          </div>
          <div>
            <label htmlFor="course" className={labelCls}>Course or assignment</label>
            <input id="course" className={inputCls} placeholder="ENGL 101, argument essay" value={f.course} onChange={(e) => set("course", e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="workedOn" className={labelCls}>What did you work on?</label>
          <textarea id="workedOn" className={inputCls} rows={3} aria-invalid={!!fieldError} aria-describedby={err} value={f.workedOn} onChange={(e) => set("workedOn", e.target.value)} />
        </div>
        <div>
          <label htmlFor="struggles" className={labelCls}>What did they struggle with?</label>
          <textarea id="struggles" className={inputCls} rows={3} aria-invalid={!!fieldError} aria-describedby={err} value={f.struggles} onChange={(e) => set("struggles", e.target.value)} />
          {fieldError && <p id="notes-error" role="alert" className="mt-1 text-sm font-medium text-margin">{fieldError}</p>}
        </div>
        <div>
          <label htmlFor="wentWell" className={labelCls}>What went well?</label>
          <textarea id="wentWell" className={inputCls} rows={2} value={f.wentWell} onChange={(e) => set("wentWell", e.target.value)} />
        </div>
        <fieldset className="space-y-4 rounded-md border border-stone-200 p-4">
          <legend className="px-1 text-sm font-semibold text-ink">AI in this course</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="courseCode" className={labelCls}>Course code (optional)</label>
              <input id="courseCode" className={inputCls} placeholder="ENGL 101" value={f.courseCode} onChange={(e) => set("courseCode", e.target.value)} onBlur={lookupPolicy} />
            </div>
            <div>
              <label htmlFor="aiPolicy" className={labelCls}>The course&apos;s AI policy</label>
              <select id="aiPolicy" className={inputCls} value={aiPolicy} onChange={(e) => setAiPolicy(e.target.value as AiPolicy)}>
                {AI_POLICIES.map((p) => <option key={p} value={p}>{p === "unknown" ? "Not sure yet" : p[0].toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="aiUse" className={labelCls}>AI use that came up (optional)</label>
            <input id="aiUse" className={inputCls} placeholder="What the student said they used it for" value={f.aiUse} onChange={(e) => set("aiUse", e.target.value)} />
          </div>
          {onFile && <p className="text-sm text-stone-600">Saved policy on file for {onFile}. You can change it above.</p>}
          <p className="text-sm text-stone-600">Not sure? The follow-up will suggest asking the professor. Nothing here judges the student&apos;s work.</p>
        </fieldset>
        <div>
          <label htmlFor="privateConcern" className={labelCls}>Private concern (optional)</label>
          <textarea id="privateConcern" className={inputCls} rows={2} placeholder="Only you see this. It never goes in the email, the printout or the AI request." value={f.privateConcern} onChange={(e) => set("privateConcern", e.target.value)} />
        </div>
        <VoiceToggle on={voice} set={setVoice} />
        <div className="flex flex-wrap items-center gap-3">
          <button className={`${btnCls} min-h-10`} disabled={loading}>Write the follow-up</button>
          <span className="text-sm text-stone-600">Ctrl or Cmd + Enter also works.</span>
        </div>
      </form>
      {loading && <Working label="Writing the follow-up" />}
      {error && (
        <div className="space-y-3">
          <ErrorBox error={error} />
          <p className="text-sm text-stone-700">Your notes are still in the form.</p>
          <button type="button" className={`${btn2Cls} min-h-10`} onClick={() => generate()} disabled={loading}>Try again</button>
        </div>
      )}

      {o && result && (
        <div ref={resultRef} className="scroll-mt-20 space-y-6">
          <p className="rounded-md border border-gold-300/70 bg-gold-50 px-4 py-3 text-sm text-stone-800">
            Saved. <Link className="font-semibold text-ink underline underline-offset-4" href={`/session/${result.id}`}>Open this session to add your reflection</Link>.
          </p>
          <SessionOutputsView id={result.id} outputs={o} editable />
        </div>
      )}
    </div>
  );
}
