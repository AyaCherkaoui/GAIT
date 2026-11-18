"use client";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import DirectorNote from "@/components/DirectorNote";
import SessionOutputsView from "@/components/SessionOutputs";
import { ErrorBox, PageHeader, Working, btn2Cls, btnBlueCls, inputCls, labelCls } from "@/components/ui";
import { fmtDate } from "@/components/format";
import { get, post } from "@/lib/client";
import type { Reflection, SessionRecord, SessionSummary } from "@/lib/types";

const FIELDS: [keyof Omit<Reflection, "updatedAt">, string][] = [
  ["learned", "What did I learn in this session?"],
  ["wentWell", "What went well?"],
  ["wantToImprove", "What do I want to improve?"],
  ["goalNextTime", "My goal for next time"],
];
type Form = { learned: string; wentWell: string; wantToImprove: string; goalNextTime: string };
const navCls = "inline-flex min-h-10 items-center text-sm font-medium text-indigo-700 underline underline-offset-4";

export default function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [form, setForm] = useState<Form>({ learned: "", wentWell: "", wantToImprove: "", goalNextTime: "" });
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [helping, setHelping] = useState(false);
  const [helpError, setHelpError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [others, setOthers] = useState<{ prev: SessionSummary | null; next: SessionSummary | null }>({ prev: null, next: null });
  const dirty = useRef(false);

  useEffect(() => {
    get<{ session: SessionRecord }>(`/api/session/${id}`)
      .then(({ session }) => {
        setSession(session);
        if (session.reflection) {
          const { updatedAt, ...r } = session.reflection;
          setForm(r);
          setSavedAt(updatedAt);
        }
      })
      .catch((e) => setError((e as Error).message));
    // The list is newest first: the next entry is the older session.
    get<{ sessions: SessionSummary[] }>("/api/session")
      .then(({ sessions }) => {
        const i = sessions.findIndex((x) => String(x.id) === id);
        if (i >= 0) setOthers({ prev: sessions[i + 1] ?? null, next: sessions[i - 1] ?? null });
      })
      .catch(() => {});
  }, [id]);

  async function save(values: Form) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/session/${id}/reflection`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(values) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not save.");
      setSavedAt((j.reflection as Reflection).updatedAt);
      dirty.current = false;
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // The reflection saves itself a moment after you stop typing.
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => save(form), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  async function help(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return setHelpError("Write a question first.");
    setHelping(true);
    setHelpError(null);
    try {
      const r = await post<{ answer: string }>(`/api/session/${id}/help`, { question });
      setAnswer(r.answer);
    } catch (err) {
      setHelpError((err as Error).message);
    } finally {
      setHelping(false);
    }
  }

  if (!session) return <div className="space-y-4"><ErrorBox error={error} />{!error && <p className="text-sm text-stone-600">Loading…</p>}</div>;
  return (
    <div className="space-y-8">
      <nav aria-label="Breadcrumb" className="-mb-4 text-sm text-stone-600">
        <Link href="/history" className={navCls}>← History</Link>
      </nav>
      <PageHeader title={`${session.student_name || "Student"} · ${session.course || "no course"}`}>{fmtDate(session.created_at)}</PageHeader>
      <ErrorBox error={error} />

      <DirectorNote sessionId={id} />

      <section aria-labelledby="refl" className="space-y-4">
        <h2 id="refl" className="font-display text-2xl font-semibold text-ink">My reflection</h2>
        <form onSubmit={(e) => { e.preventDefault(); save(form); }} className="max-w-prose space-y-4 rounded-xl border border-stone-200 bg-white p-5 sm:p-6">
          {FIELDS.map(([key, label]) => (
            <div key={key}>
              <label htmlFor={`f-${key}`} className={labelCls}>{label}</label>
              <textarea
                id={`f-${key}`}
                className={`${inputCls} ruled`}
                rows={2}
                value={form[key]}
                onChange={(e) => { dirty.current = true; setForm({ ...form, [key]: e.target.value }); }}
              />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <button className={`${btnBlueCls} min-h-10`} disabled={saving}>Save reflection</button>
            <span role="status" className="text-sm text-stone-600">
              {saving ? "Saving…" : saveError ? "" : savedAt ? `Saved ${new Date(savedAt).toLocaleString()}` : "Saves as you type."}
            </span>
          </div>
          {saveError && <ErrorBox error={`${saveError} Your text is still here; press Save reflection to try again.`} />}
        </form>
      </section>

      <section aria-labelledby="coach" className="space-y-4 border-t border-stone-200 pt-6">
        <div>
          <h2 id="coach" className="font-display text-2xl font-semibold text-ink">How could I have helped this student better?</h2>
          <p className="mt-1 max-w-prose text-sm text-stone-600">Ask about this session and get coaching for next time.</p>
        </div>
        <form onSubmit={help} className="max-w-prose space-y-3">
          <div>
            <label htmlFor="question" className={labelCls}>Your question</label>
            <textarea id="question" className={`${inputCls} ruled`} rows={2} placeholder="They kept saying 'it's fine'. How can I get them talking?" value={question} onChange={(e) => setQuestion(e.target.value)} />
          </div>
          <button className={`${btn2Cls} min-h-10`} disabled={helping}>{helping ? "Thinking…" : "Ask for coaching"}</button>
          {helping && <Working label="Thinking about your question" />}
          <ErrorBox error={helpError} />
          {answer && <p className="whitespace-pre-wrap rounded-xl border border-gold-300 bg-gold-100/70 p-4 text-[15px] text-stone-800">{answer}</p>}
        </form>
      </section>

      {session.notes.privateConcern?.trim() && (
        <section aria-labelledby="s-private" className="space-y-3 border-t border-stone-200 pt-6">
          <h2 id="s-private" className="font-display text-2xl font-semibold text-ink">Private, tutor only</h2>
          <p className="max-w-prose whitespace-pre-wrap rounded-lg border border-stone-200 bg-stone-50 p-4 text-[15px] text-stone-800">{session.notes.privateConcern}</p>
          <p className="text-sm text-stone-600">Never in the email, the printout or the AI request.</p>
        </section>
      )}

      <section aria-labelledby="s-out" className="space-y-3 border-t border-stone-200 pt-6">
        <h2 id="s-out" className="font-display text-2xl font-semibold text-ink">Follow-up for the student</h2>
        <SessionOutputsView id={session.id} outputs={session.outputs} />
      </section>

      <nav aria-label="Other sessions" className="flex flex-wrap justify-between gap-3 border-t border-stone-200 pt-4">
        {others.prev ? <Link href={`/session/${others.prev.id}`} className={navCls}>← Previous: {others.prev.student_name || "Student"}, {fmtDate(others.prev.created_at)}</Link> : <span />}
        {others.next ? <Link href={`/session/${others.next.id}`} className={navCls}>Next: {others.next.student_name || "Student"}, {fmtDate(others.next.created_at)} →</Link> : <span />}
      </nav>
    </div>
  );
}
