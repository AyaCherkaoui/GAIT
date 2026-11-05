"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import CopyButton from "@/components/CopyButton";
import { Card, ErrorBox, btnCls, inputCls } from "@/components/ui";
import { get, post } from "@/lib/client";
import type { SessionOutputs, SessionRecord, SessionSummary } from "@/lib/types";

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
  const [past, setPast] = useState<SessionSummary[]>([]);

  const loadPast = () => get<{ sessions: SessionSummary[] }>("/api/session").then((j) => setPast(j.sessions)).catch(() => {});
  useEffect(() => { loadPast(); }, []);

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
      loadPast();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function open(id: number) {
    setError(null);
    try {
      const { session } = await get<{ session: SessionRecord }>(`/api/session/${id}`);
      setStudentName(session.student_name);
      setCourse(session.course);
      setWorkedOn(session.notes.workedOn);
      setStruggles(session.notes.struggles);
      setWentWell(session.notes.wentWell);
      setResult({ id: session.id, outputs: session.outputs });
      setEmail(session.outputs.email);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const o = result?.outputs;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">After session</h1>
      <form onSubmit={generate} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={inputCls} placeholder="Student first name" value={studentName} onChange={(e) => setStudentName(e.target.value)} />
          <input className={inputCls} placeholder="Course / assignment (e.g. ENGL 101, argument essay)" value={course} onChange={(e) => setCourse(e.target.value)} />
        </div>
        <textarea className={inputCls} rows={3} placeholder="What did you work on?" value={workedOn} onChange={(e) => setWorkedOn(e.target.value)} />
        <textarea className={inputCls} rows={3} placeholder="What did they struggle with?" value={struggles} onChange={(e) => setStruggles(e.target.value)} />
        <textarea className={inputCls} rows={2} placeholder="What went well?" value={wentWell} onChange={(e) => setWentWell(e.target.value)} />
        <button className={btnCls} disabled={loading}>{loading ? "Writing…" : "Generate follow-up"}</button>
      </form>
      <ErrorBox error={error} />

      {o && result && (
        <div className="space-y-4">
          <Card title="Email draft" actions={<CopyButton text={email} />}>
            <textarea className={inputCls} rows={12} value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">Edit it, copy it, and send it from your own email.</p>
          </Card>
          <Card title="Next steps" actions={<Link className="text-sm text-indigo-700 underline" href={`/session/${result.id}/print`} target="_blank">Printable page</Link>}>
            <ul className="list-disc space-y-1 pl-5 text-sm">{o.nextSteps.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </Card>
          <Card title="Focus areas">
            <div className="space-y-3 text-sm">
              {o.focusAreas.map((f, i) => (
                <div key={i}>
                  <p className="font-medium">{f.skill}</p>
                  <p className="text-slate-600">{f.why}</p>
                  <p className="mt-1">{f.miniLesson}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Use AI like a coach (prompts for the student)">
            <ul className="space-y-3 text-sm">
              {o.aiPrompts.map((p, i) => (
                <li key={i} className="rounded bg-slate-50 p-2">
                  <div className="flex items-start justify-between gap-2">
                    <code className="whitespace-pre-wrap">{p.prompt}</code>
                    <CopyButton text={p.prompt} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{p.whyItHelps}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm font-medium">Don&apos;t ask AI to…</p>
            <ul className="list-disc pl-5 text-sm">{o.dontAskAi.map((d, i) => <li key={i}>{d}</li>)}</ul>
          </Card>
        </div>
      )}

      {past.length > 0 && (
        <Card title="Past sessions">
          <ul className="space-y-1 text-sm">
            {past.map((s) => (
              <li key={s.id}>
                <button className="text-indigo-700 hover:underline" onClick={() => open(s.id)}>
                  {s.student_name || "Student"} · {s.course || "no course"} · {s.created_at}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
