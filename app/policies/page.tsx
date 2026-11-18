"use client";
import { useEffect, useState } from "react";
import CopyButton from "@/components/CopyButton";
import { Card, Chip, Empty, ErrorBox, Loading, PageHeader, btn2Cls, btnCls, inputCls, labelCls, submitOnCmdEnter } from "@/components/ui";
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    get<{ policies: CoursePolicy[] }>(`/api/policies?q=${encodeURIComponent(q)}`)
      .then((j) => { setList(j.policies); setLoaded(true); })
      .catch((e) => setError(e.message));
  }, [q]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await post("/api/policies", { courseCode, professor, policy, details, source });
      setCourseCode(""); setProfessor(""); setPolicy("unknown"); setDetails(""); setSource("");
      setQ("");
      const j = await get<{ policies: CoursePolicy[] }>("/api/policies?q=");
      setList(j.policies);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
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
            <textarea id="pol-details" className={inputCls} rows={2} placeholder="For example, OK for brainstorming, must be disclosed" value={details} onChange={(e) => setDetails(e.target.value)} onKeyDown={submitOnCmdEnter} />
          </div>
          <div>
            <label htmlFor="pol-source" className={labelCls}>Source</label>
            <input id="pol-source" className={`${inputCls} min-h-11`} placeholder="For example, syllabus, fall 2026" value={source} onChange={(e) => setSource(e.target.value)} />
          </div>
          <button className={`${btnCls} min-h-11`} disabled={saving}>{saving ? "Saving…" : "Save policy"}</button>
        </form>
      </Card>
      <ErrorBox error={error} />
      <Card title="Saved policies">
        <label htmlFor="pol-search" className={labelCls}>Filter by course code</label>
        <input id="pol-search" className={`${inputCls} min-h-11`} placeholder="For example, ENGL 101 (a professor's name works too)" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="mt-4">
          {!loaded && !error && <Loading />}
          {loaded && list.length === 0 && (q ? <Empty title={`No policy matches "${q}"`}>Check the course code, or add it above.</Empty> : <Empty title="No policies saved yet">Add a course above and it will show up here.</Empty>)}
          {list.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {list.map((p) => (
                <li key={p.course_code} className="flex flex-col justify-between gap-3 rounded-lg border border-stone-200 bg-white p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-lg font-semibold text-ink">{p.course_code}</h3><Chip tone={p.policy === "unknown" ? "plain" : "gold"}>{LABEL[p.policy]}</Chip></div>
                    {p.professor && <p className="text-sm text-stone-600">{p.professor}</p>}
                    {p.details && <p className="mt-2 break-words text-[15px] text-stone-800">{p.details}</p>}
                    {p.source && <p className="mt-2 text-xs text-stone-600">Source: {p.source} · updated {p.updated_at.slice(0, 10)}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <CopyButton text={`${p.course_code}${p.professor ? ` (${p.professor})` : ""}: AI ${LABEL[p.policy].toLowerCase()}.${p.details ? ` ${p.details}` : ""}${p.source ? ` Source: ${p.source}.` : ""}`} label="Copy" />
                    <button className={`${btn2Cls} min-h-10`} onClick={() => edit(p)}>Edit</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
