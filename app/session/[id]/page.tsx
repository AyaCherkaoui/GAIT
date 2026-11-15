"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import CopyButton from "@/components/CopyButton";
import { Card, ErrorBox, PageHeader, Loading, Working, btn2Cls, btnCls, inputCls } from "@/components/ui";
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
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Couldn't save. Try again.");
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

  if (!session) return <div className="space-y-4"><ErrorBox error={error} />{!error && <Loading />}</div>;
  const o = session.outputs;
  return (
    <div className="space-y-6">
      <PageHeader title={`${session.student_name || "Student"} · ${session.course || "no course"}`}>{session.created_at}</PageHeader>
      <ErrorBox error={error} />

      <Card title="My reflection">
        <form onSubmit={save} className="space-y-3 text-sm">
          {FIELDS.map(([key, label]) => (
            <label key={key} className="block">
              <span className="mb-1 block font-medium">{label}</span>
              <textarea className={inputCls} rows={2} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </label>
          ))}
          <div className="flex items-center gap-3">
            <button className={btnCls} disabled={busy === "save"}>{busy === "save" ? "Saving…" : "Save reflection"}</button>
            {savedAt && <span className="text-xs text-stone-500">Saved {new Date(savedAt).toLocaleString()}</span>}
          </div>
        </form>
      </Card>

      <Card title="How could I have helped this student better?">
        <form onSubmit={help} className="space-y-3 text-sm">
          <textarea className={inputCls} rows={2} placeholder="e.g. They kept saying 'it's fine'. How can I get them talking?" value={question} onChange={(e) => setQuestion(e.target.value)} />
          <button className={btn2Cls} disabled={busy === "help"}>Ask for coaching</button>
          {busy === "help" && <Working label="Thinking about your question" />}
          {answer && <p className="whitespace-pre-wrap rounded-lg bg-stone-50 p-3">{answer}</p>}
        </form>
      </Card>

      {session.notes.privateConcern?.trim() && (
        <Card title="Private, tutor only">
          <p className="whitespace-pre-wrap text-sm">{session.notes.privateConcern}</p>
        </Card>
      )}

      <Card title="Email draft" actions={<CopyButton text={o.email} />}>
        <p className="whitespace-pre-wrap text-sm">{o.email}</p>
      </Card>
      <Card title="Next steps" actions={<Link className="text-sm text-indigo-700 underline" href={`/session/${session.id}/print`} target="_blank">Printable page</Link>}>
        <ul className="list-disc space-y-1 pl-5 text-sm">{o.nextSteps.map((s, i) => <li key={i}>{s}</li>)}</ul>
      </Card>
    </div>
  );
}
