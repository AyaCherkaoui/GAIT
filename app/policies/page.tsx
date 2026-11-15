"use client";
import { useEffect, useState } from "react";
import { Card, Chip, Empty, ErrorBox, PageHeader, btn2Cls, btnCls, inputCls, labelCls } from "@/components/ui";
import { get, post } from "@/lib/client";
import { AI_POLICIES, type AiPolicy, type CoursePolicy } from "@/lib/policy-types";

const LABEL: Record<AiPolicy, string> = { allowed: "Allowed", limited: "Limited", banned: "Not allowed", unknown: "Not sure yet" };

export default function PoliciesPage() {
  const [q, setQ] = useState("");
  const [list, setList] = useState<CoursePolicy[]>([]);
  const [courseCode, setCourseCode] = useState("");
  const [professor, setProfessor] = useState("");
  const [policy, setPolicy] = useState<AiPolicy>("unknown");
  const [details, setDetails] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    get<{ policies: CoursePolicy[] }>(`/api/policies?q=${encodeURIComponent(q)}`)
      .then((j) => { setList(j.policies); setLoaded(true); })
      .catch((e) => setError(e.message));
  }, [q]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await post("/api/policies", { courseCode, professor, policy, details, source });
      setCourseCode(""); setProfessor(""); setPolicy("unknown"); setDetails(""); setSource("");
      setQ("");
      const j = await get<{ policies: CoursePolicy[] }>("/api/policies?q=");
      setList(j.policies);
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
      <PageHeader title="Course AI policies">What each course&apos;s syllabus says about AI, so you can check it with a student. Only you see the policies you save.</PageHeader>
      <Card tone="note">
        <p className="text-sm text-stone-800"><Chip tone="gold">Draft: director to confirm</Chip> <span className="ml-1">The policy choices below are placeholders. Always confirm with the syllabus or the professor, not this list.</span></p>
      </Card>
      <Card title="Add or edit a policy">
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="pol-code" className={labelCls}>Course code</label>
              <input id="pol-code" className={`${inputCls} min-h-11`} placeholder="ENGL 101" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} />
            </div>
            <div>
              <label htmlFor="pol-prof" className={labelCls}>Professor</label>
              <input id="pol-prof" className={`${inputCls} min-h-11`} value={professor} onChange={(e) => setProfessor(e.target.value)} />
            </div>
            <div>
              <label htmlFor="pol-policy" className={labelCls}>AI policy</label>
              <select id="pol-policy" className={`${inputCls} min-h-11`} value={policy} onChange={(e) => setPolicy(e.target.value as AiPolicy)}>
                {AI_POLICIES.map((p) => <option key={p} value={p}>{LABEL[p]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="pol-details" className={labelCls}>Details</label>
            <textarea id="pol-details" className={inputCls} rows={2} placeholder="For example, OK for brainstorming, must be disclosed" value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pol-source" className={labelCls}>Source</label>
            <input id="pol-source" className={`${inputCls} min-h-11`} placeholder="For example, syllabus, fall 2026" value={source} onChange={(e) => setSource(e.target.value)} />
          </div>
          <button className={`${btnCls} min-h-11`}>Save policy</button>
        </form>
      </Card>
      <ErrorBox error={error} />
      <Card title="Saved policies">
        <label htmlFor="pol-search" className="sr-only">Search by course code or professor</label>
        <input id="pol-search" className={`${inputCls} min-h-11`} placeholder="Search by course code or professor" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="mt-4">
          {loaded && list.length === 0 && <Empty title="No policies saved yet">Add a course above and it will show up here.</Empty>}
          {list.length > 0 && (
            <ul className="divide-y divide-stone-200">
              {list.map((p) => (
                <li key={p.course_code} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="break-words"><span className="font-semibold text-ink">{p.course_code}</span> <Chip tone={p.policy === "unknown" ? "plain" : "gold"}>{LABEL[p.policy]}</Chip>{p.professor && <span className="ml-2 text-sm text-stone-600">{p.professor}</span>}</p>
                    {p.details && <p className="mt-1 text-[15px] text-stone-700">{p.details}</p>}
                    {p.source && <p className="mt-1 text-xs text-stone-600">Source: {p.source} · updated {p.updated_at.slice(0, 10)}</p>}
                  </div>
                  <button className={`${btn2Cls} min-h-10 shrink-0`} onClick={() => edit(p)}>Edit</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
