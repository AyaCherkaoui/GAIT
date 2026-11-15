"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import CopyButton from "@/components/CopyButton";
import { ErrorBox, PageHeader, Working, btn2Cls, btnCls, inputCls, labelCls } from "@/components/ui";
import { fmtDate } from "@/components/format";
import { get, post } from "@/lib/client";
import type { Reflection, SessionRecord } from "@/lib/types";

const FIELDS: [keyof Omit<Reflection, "updatedAt">, string][] = [
  ["learned", "What did I learn in this session?"],
  ["wentWell", "What went well?"],
  ["wantToImprove", "What do I want to improve?"],
  ["goalNextTime", "My goal for next time"],
];

export default function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [form, setForm] = useState({ learned: "", wentWell: "", wantToImprove: "", goalNextTime: "" });
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState<"save" | "help" | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }, [id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    setError(null);
    try {
      const res = await fetch(`/api/session/${id}/reflection`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not save.");
      setSavedAt((j.reflection as Reflection).updatedAt);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function help(e: React.FormEvent) {
    e.preventDefault();
    setBusy("help");
    setError(null);
    try {
      const r = await post<{ answer: string }>(`/api/session/${id}/help`, { question });
      setAnswer(r.answer);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!session) return <div className="space-y-4"><ErrorBox error={error} />{!error && <p className="text-sm text-stone-600">Loading…</p>}</div>;
  const o = session.outputs;
  return (
    <div className="space-y-8">
      <PageHeader title={`${session.student_name || "Student"} · ${session.course || "no course"}`}>{fmtDate(session.created_at)}</PageHeader>
      <ErrorBox error={error} />

      <section aria-labelledby="refl" className="space-y-4">
        <h2 id="refl" className="font-display text-2xl font-semibold text-ink">My reflection</h2>
        <form onSubmit={save} className="max-w-prose space-y-4 rounded-lg border border-stone-200 bg-white p-5 sm:p-6">
          {FIELDS.map(([key, label]) => (
            <div key={key}>
              <label htmlFor={`f-${key}`} className={labelCls}>{label}</label>
              <textarea id={`f-${key}`} className={inputCls} rows={2} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <button className={`${btnCls} min-h-10`} disabled={busy === "save"}>Save reflection</button>
            {savedAt && <span className="text-sm text-stone-600">Saved {new Date(savedAt).toLocaleString()}</span>}
          </div>
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
            <textarea id="question" className={inputCls} rows={2} placeholder="They kept saying 'it's fine'. How can I get them talking?" value={question} onChange={(e) => setQuestion(e.target.value)} />
          </div>
          <button className={`${btn2Cls} min-h-10`} disabled={busy === "help"}>Ask for coaching</button>
          {busy === "help" && <Working label="Thinking about your question" />}
          {answer && <p className="whitespace-pre-wrap rounded-lg border border-gold-300/70 bg-gold-50 p-4 text-[15px] text-stone-800">{answer}</p>}
        </form>
      </section>

      <section aria-labelledby="s-email" className="space-y-3 border-t border-stone-200 pt-6">
        <div className="flex items-center justify-between gap-2">
          <h2 id="s-email" className="font-display text-2xl font-semibold text-ink">Email draft</h2>
          <CopyButton text={o.email} />
        </div>
        <p className="max-w-prose whitespace-pre-wrap rounded-lg border border-stone-200 bg-white p-4 text-[15px] text-stone-800">{o.email}</p>
      </section>

      <section aria-labelledby="s-steps" className="space-y-3 border-t border-stone-200 pt-6">
        <div className="flex items-center justify-between gap-2">
          <h2 id="s-steps" className="font-display text-2xl font-semibold text-ink">Next steps</h2>
          <Link className="inline-flex min-h-10 items-center text-sm font-medium text-indigo-700 underline underline-offset-4" href={`/session/${session.id}/print`} target="_blank">Open printable page</Link>
        </div>
        <ul className="max-w-prose list-disc space-y-1.5 pl-5 text-[15px] text-stone-800">{o.nextSteps.map((s, i) => <li key={i}>{s}</li>)}</ul>
      </section>
    </div>
  );
}
