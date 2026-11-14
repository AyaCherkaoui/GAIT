"use client";
import Link from "next/link";
import { useState } from "react";
import CopyButton from "@/components/CopyButton";
import { Card, ErrorBox, PageHeader, Working, btnCls, inputCls } from "@/components/ui";
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
    <div className="space-y-6">
      <PageHeader title="After session">Write up your notes and get a follow-up for the student.</PageHeader>
      <form onSubmit={generate} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={inputCls} placeholder="Student first name" value={studentName} onChange={(e) => setStudentName(e.target.value)} />
          <input className={inputCls} placeholder="Course / assignment (e.g. ENGL 101, argument essay)" value={course} onChange={(e) => setCourse(e.target.value)} />
        </div>
        <textarea className={inputCls} rows={3} placeholder="What did you work on?" value={workedOn} onChange={(e) => setWorkedOn(e.target.value)} />
        <textarea className={inputCls} rows={3} placeholder="What did they struggle with?" value={struggles} onChange={(e) => setStruggles(e.target.value)} />
        <textarea className={inputCls} rows={2} placeholder="What went well?" value={wentWell} onChange={(e) => setWentWell(e.target.value)} />
        <button className={btnCls} disabled={loading}>Generate follow-up</button>
      </form>
      {loading && <Working label="Writing the follow-up" />}
      <ErrorBox error={error} />

      {o && result && (
        <div className="space-y-4">
          <p className="text-sm">
            Saved. <Link className="text-indigo-700 underline" href={`/session/${result.id}`}>Open this session to add your reflection</Link>.
          </p>
          <Card title="Email draft" actions={<CopyButton text={email} />}>
            <textarea className={inputCls} rows={12} value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="mt-1 text-xs text-stone-500">Edit it, copy it, and send it from your own email.</p>
          </Card>
          <Card title="Next steps" actions={<Link className="text-sm text-indigo-700 underline" href={`/session/${result.id}/print`} target="_blank">Printable page</Link>}>
            <ul className="list-disc space-y-1 pl-5 text-sm">{o.nextSteps.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </Card>
          <Card title="Focus areas">
            <div className="space-y-3 text-sm">
              {o.focusAreas.map((f, i) => (
                <div key={i}>
                  <p className="font-medium">{f.skill}</p>
                  <p className="text-stone-600">{f.why}</p>
                  <p className="mt-1">{f.miniLesson}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Use AI like a coach (prompts for the student)">
            <ul className="space-y-3 text-sm">
              {o.aiPrompts.map((p, i) => (
                <li key={i} className="rounded bg-stone-50 p-2">
                  <div className="flex items-start justify-between gap-2">
                    <code className="whitespace-pre-wrap">{p.prompt}</code>
                    <CopyButton text={p.prompt} />
                  </div>
                  <p className="mt-1 text-xs text-stone-500">{p.whyItHelps}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm font-medium">Don&apos;t ask AI to…</p>
            <ul className="list-disc pl-5 text-sm">{o.dontAskAi.map((d, i) => <li key={i}>{d}</li>)}</ul>
          </Card>
        </div>
      )}

    </div>
  );
}
