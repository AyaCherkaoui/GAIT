"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import CopyButton from "@/components/CopyButton";
import VoiceToggle, { useVoiceFirst } from "@/components/VoiceToggle";
import { Card, ErrorBox, btnCls, inputCls } from "@/components/ui";
import { get, post } from "@/lib/client";
import { AI_POLICIES, type AiPolicy, type CoursePolicy, type SessionOutputs, type SessionRecord, type SessionSummary } from "@/lib/types";

export default function SessionPage() {
  const [studentName, setStudentName] = useState("");
  const [course, setCourse] = useState("");
  const [workedOn, setWorkedOn] = useState("");
  const [struggles, setStruggles] = useState("");
  const [wentWell, setWentWell] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [aiPolicy, setAiPolicy] = useState<AiPolicy>("unknown");
  const [policyOnFile, setPolicyOnFile] = useState<CoursePolicy | null>(null);
  const [policyChecked, setPolicyChecked] = useState(false);
  const [aiUse, setAiUse] = useState("");
  const [privateConcern, setPrivateConcern] = useState("");
  const [voice, setVoice] = useVoiceFirst();
  const [sessionNote, setSessionNote] = useState("");
  const [directorNote, setDirectorNote] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: number; outputs: SessionOutputs } | null>(null);
  const [email, setEmail] = useState("");
  const [past, setPast] = useState<SessionSummary[]>([]);

  const loadPast = () => get<{ sessions: SessionSummary[] }>("/api/session").then((j) => setPast(j.sessions)).catch(() => {});
  useEffect(() => { loadPast(); }, []);

  async function lookupPolicy() {
    const code = courseCode.trim();
    if (!code) return;
    try {
      const { policy } = await get<{ policy: CoursePolicy | null }>(`/api/policies?code=${encodeURIComponent(code)}`);
      setPolicyOnFile(policy);
      setPolicyChecked(true);
      if (policy) setAiPolicy(policy.policy);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function savePolicy() {
    setSaveMsg("");
    try {
      const { policy } = await post<{ policy: CoursePolicy }>("/api/policies", {
        courseCode, policy: aiPolicy, source: "Checked with the student at a session",
      });
      setPolicyOnFile(policy);
      setSaveMsg(`Saved for ${policy.course_code}.`);
    } catch (err) {
      setSaveMsg((err as Error).message);
    }
  }

  async function draftDirectorNote() {
    if (!result) return;
    setError(null);
    try {
      const r = await post<{ note: string }>(`/api/session/${result.id}/director-note`, {});
      setDirectorNote(r.note);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await post<{ id: number; outputs: SessionOutputs }>("/api/session", {
        studentName, course, voice,
        notes: { workedOn, struggles, wentWell, courseCode, aiPolicy, aiUse, privateConcern },
      });
      setResult(r);
      setSessionNote(r.outputs.sessionNote ?? "");
      setDirectorNote("");
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
      setCourseCode(session.notes.courseCode ?? "");
      setAiPolicy(session.notes.aiPolicy ?? "unknown");
      setAiUse(session.notes.aiUse ?? "");
      setPrivateConcern(session.notes.privateConcern ?? "");
      setSessionNote(session.outputs.sessionNote ?? "");
      setDirectorNote("");
      setPolicyChecked(false);
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
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={inputCls} placeholder="Course code (e.g. ENGL 101)" value={courseCode} onChange={(e) => { setCourseCode(e.target.value); setPolicyChecked(false); }} onBlur={lookupPolicy} />
          <label className="flex items-center gap-2 text-sm">
            AI policy
            <select className={inputCls} value={aiPolicy} onChange={(e) => setAiPolicy(e.target.value as AiPolicy)}>
              {AI_POLICIES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
        </div>
        {policyOnFile && (
          <p className="text-xs text-slate-600">
            On file for {policyOnFile.course_code}: {policyOnFile.policy}{policyOnFile.details ? `. ${policyOnFile.details}` : ""} You can change the policy above.
          </p>
        )}
        {policyChecked && !policyOnFile && courseCode.trim() && (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
            <p className="font-medium">No policy on file for {courseCode.trim().toUpperCase()}.</p>
            <p className="mt-1">Try this: &quot;Let&apos;s look at your syllabus together. Is there a section on AI or technology? What does it say about brainstorming, drafting, and editing? If it isn&apos;t there, ask your professor, and we can note what they say.&quot;</p>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-white" onClick={savePolicy}>Save the policy chosen above for this course</button>
              {saveMsg && <span className="text-xs">{saveMsg}</span>}
            </div>
          </div>
        )}
        <textarea className={inputCls} rows={3} placeholder="What did you work on?" value={workedOn} onChange={(e) => setWorkedOn(e.target.value)} />
        <textarea className={inputCls} rows={3} placeholder="What did they struggle with?" value={struggles} onChange={(e) => setStruggles(e.target.value)} />
        <textarea className={inputCls} rows={2} placeholder="What went well?" value={wentWell} onChange={(e) => setWentWell(e.target.value)} />
        <input className={inputCls} placeholder="AI use that came up (optional): what the student said they used it for" value={aiUse} onChange={(e) => setAiUse(e.target.value)} />
        <textarea className={inputCls} rows={2} placeholder="Private concern (optional, tutor only: never goes in the email or printout)" value={privateConcern} onChange={(e) => setPrivateConcern(e.target.value)} />
        <VoiceToggle on={voice} set={setVoice} />
        <button className={btnCls} disabled={loading}>{loading ? "Writing…" : "Generate follow-up"}</button>
      </form>
      <ErrorBox error={error} />

      {o && result && (
        <div className="space-y-4">
          <Card title="Email draft" actions={<CopyButton text={email} />}>
            <textarea className={inputCls} rows={12} value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">Edit it, copy it, and send it from your own email.</p>
          </Card>
          {o.voiceFlags && o.voiceFlags.length > 0 && (
            <Card title="Voice-first flags">
              <ul className="list-disc pl-5 text-sm">{o.voiceFlags.map((f, i) => <li key={i}>{f}</li>)}</ul>
            </Card>
          )}
          <Card title="Session note (for the center's records)" actions={<CopyButton text={sessionNote} />}>
            <textarea className={inputCls} rows={8} value={sessionNote} onChange={(e) => setSessionNote(e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">Organized by the RWC rubric. Edit it, then copy it into your records.</p>
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

      {o && result && (
        <Card title="Private, tutor only">
          <div className="space-y-2 text-sm">
            <p className="whitespace-pre-wrap">{privateConcern.trim() || "No private concern noted."}</p>
            <button type="button" className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100" onClick={draftDirectorNote}>Draft a note to the director</button>
            {directorNote && (
              <>
                <textarea className={inputCls} rows={8} value={directorNote} onChange={(e) => setDirectorNote(e.target.value)} />
                <CopyButton text={directorNote} />
                <p className="text-xs text-slate-500">Not saved anywhere. Copy it if you want to send it.</p>
              </>
            )}
          </div>
        </Card>
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
