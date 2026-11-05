"use client";
import { useEffect, useState } from "react";
import { Card, ErrorBox, btnCls, inputCls } from "@/components/ui";
import { get, post } from "@/lib/client";
import { AI_POLICIES, type AiPolicy, type CoursePolicy } from "@/lib/types";

export default function PoliciesPage() {
  const [q, setQ] = useState("");
  const [list, setList] = useState<CoursePolicy[]>([]);
  const [courseCode, setCourseCode] = useState("");
  const [professor, setProfessor] = useState("");
  const [policy, setPolicy] = useState<AiPolicy>("unknown");
  const [details, setDetails] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = (text: string) =>
    get<{ policies: CoursePolicy[] }>(`/api/policies?q=${encodeURIComponent(text)}`).then((j) => setList(j.policies)).catch((e) => setError(e.message));
  useEffect(() => { load(q); }, [q]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await post("/api/policies", { courseCode, professor, policy, details, source });
      setCourseCode(""); setProfessor(""); setPolicy("unknown"); setDetails(""); setSource("");
      load(q);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function edit(p: CoursePolicy) {
    setCourseCode(p.course_code); setProfessor(p.professor); setPolicy(p.policy); setDetails(p.details); setSource(p.source);
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Course AI policies</h1>
        <p className="text-sm text-slate-600">What each course&apos;s syllabus says about AI. Saved on this computer and filled in on the After session page.</p>
      </div>
      <Card title="Add or edit a policy">
        <form onSubmit={save} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <input className={inputCls} placeholder="Course code (ENGL 101)" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} />
            <input className={inputCls} placeholder="Professor" value={professor} onChange={(e) => setProfessor(e.target.value)} />
            <select className={inputCls} value={policy} onChange={(e) => setPolicy(e.target.value as AiPolicy)}>
              {AI_POLICIES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <textarea className={inputCls} rows={2} placeholder="Details (e.g. OK for brainstorming, must be disclosed)" value={details} onChange={(e) => setDetails(e.target.value)} />
          <input className={inputCls} placeholder="Source (e.g. syllabus, fall 2026)" value={source} onChange={(e) => setSource(e.target.value)} />
          <button className={btnCls}>Save policy</button>
        </form>
      </Card>
      <ErrorBox error={error} />
      <Card title="Search">
        <input className={inputCls} placeholder="Search by course code or professor" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="mt-3 space-y-2 text-sm">
          {list.length === 0 && <li className="text-slate-500">No policies saved yet.</li>}
          {list.map((p) => (
            <li key={p.course_code} className="rounded bg-slate-50 p-2">
              <div className="flex items-start justify-between gap-2">
                <p><span className="font-medium">{p.course_code}</span> · {p.policy}{p.professor ? ` · ${p.professor}` : ""}</p>
                <button className="text-xs text-indigo-700 underline" onClick={() => edit(p)}>Edit</button>
              </div>
              {p.details && <p className="text-slate-600">{p.details}</p>}
              {p.source && <p className="text-xs text-slate-500">Source: {p.source} · updated {p.updated_at.slice(0, 10)}</p>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
