"use client";
import Link from "next/link";
import { useState } from "react";
import CopyButton from "@/components/CopyButton";
import { ErrorBox, PageHeader, Working, btnCls, inputCls, labelCls } from "@/components/ui";
import { post } from "@/lib/client";
import type { SessionOutputs } from "@/lib/types";

export default function SessionPage() {
  const [studentName, setStudentName] = useState("");
  const [course, setCourse] = useState("");
  const [workedOn, setWorkedOn] = useState("");
  const [struggles, setStruggles] = useState("");
  const [wentWell, setWentWell] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: number; outputs: SessionOutputs } | null>(null);
  const [email, setEmail] = useState("");

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await post<{ id: number; outputs: SessionOutputs }>("/api/session", {
        studentName, course, notes: { workedOn, struggles, wentWell },
      });
      setResult(r);
      setEmail(r.outputs.email);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const o = result?.outputs;
  return (
    <div className="space-y-8">
      <PageHeader title="After session">Write up your notes and get a follow-up for the student.</PageHeader>
      <form onSubmit={generate} className="space-y-4 rounded-lg border border-stone-200 bg-white p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="studentName" className={labelCls}>Student first name</label>
            <input id="studentName" className={inputCls} value={studentName} onChange={(e) => setStudentName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="course" className={labelCls}>Course or assignment</label>
            <input id="course" className={inputCls} placeholder="ENGL 101, argument essay" value={course} onChange={(e) => setCourse(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="workedOn" className={labelCls}>What did you work on?</label>
          <textarea id="workedOn" className={inputCls} rows={3} value={workedOn} onChange={(e) => setWorkedOn(e.target.value)} />
        </div>
        <div>
          <label htmlFor="struggles" className={labelCls}>What did they struggle with?</label>
          <textarea id="struggles" className={inputCls} rows={3} value={struggles} onChange={(e) => setStruggles(e.target.value)} />
        </div>
        <div>
          <label htmlFor="wentWell" className={labelCls}>What went well?</label>
          <textarea id="wentWell" className={inputCls} rows={2} value={wentWell} onChange={(e) => setWentWell(e.target.value)} />
        </div>
        <button className={`${btnCls} min-h-10`} disabled={loading}>Write the follow-up</button>
      </form>
      {loading && <Working label="Writing the follow-up" />}
      <ErrorBox error={error} />

      {o && result && (
        <div className="space-y-8">
          <p className="rounded-md border border-gold-300/70 bg-gold-50 px-4 py-3 text-sm text-stone-800">
            Saved. <Link className="font-semibold text-ink underline underline-offset-4" href={`/session/${result.id}`}>Open this session to add your reflection</Link>.
          </p>

          <section aria-labelledby="out-email" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 id="out-email" className="font-display text-2xl font-semibold text-ink">Email draft</h2>
              <CopyButton text={email} />
            </div>
            <label htmlFor="emailDraft" className="sr-only">Email draft</label>
            <textarea id="emailDraft" className={inputCls} rows={12} value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="text-sm text-stone-600">Edit it, copy it, and send it from your own email.</p>
          </section>

          <section aria-labelledby="out-steps" className="space-y-3 border-t border-stone-200 pt-6">
            <div className="flex items-center justify-between gap-2">
              <h2 id="out-steps" className="font-display text-2xl font-semibold text-ink">Next steps</h2>
              <Link className="inline-flex min-h-10 items-center text-sm font-medium text-indigo-700 underline underline-offset-4" href={`/session/${result.id}/print`} target="_blank">Open printable page</Link>
            </div>
            <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-stone-800">{o.nextSteps.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </section>

          <section aria-labelledby="out-focus" className="space-y-3 border-t border-stone-200 pt-6">
            <h2 id="out-focus" className="font-display text-2xl font-semibold text-ink">Focus areas</h2>
            <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
              {o.focusAreas.map((f, i) => (
                <li key={i} className="max-w-prose px-5 py-4 text-[15px]">
                  <p className="font-semibold text-ink"><span className="mark">{f.skill}</span></p>
                  <p className="mt-1 text-stone-600">{f.why}</p>
                  <p className="mt-2 text-stone-800">{f.miniLesson}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="out-ai" className="space-y-3 border-t border-stone-200 pt-6">
            <div>
              <h2 id="out-ai" className="font-display text-2xl font-semibold text-ink">Use AI like a coach</h2>
              <p className="mt-1 text-sm text-stone-600">Prompts the student can paste into an AI tool. Each one keeps them doing the writing.</p>
            </div>
            <ul className="space-y-3">
              {o.aiPrompts.map((p, i) => (
                <li key={i} className="rounded-lg border border-stone-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <code className="min-w-0 whitespace-pre-wrap break-words text-sm text-stone-900">{p.prompt}</code>
                    <CopyButton text={p.prompt} />
                  </div>
                  <p className="mt-2 max-w-prose text-sm text-stone-600">{p.whyItHelps}</p>
                </li>
              ))}
            </ul>
            <div className="rounded-lg border-l-4 border-margin bg-red-50 px-4 py-3">
              <p className="text-sm font-semibold text-margin">Don&apos;t ask AI to…</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-stone-800">{o.dontAskAi.map((d, i) => <li key={i}>{d}</li>)}</ul>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
