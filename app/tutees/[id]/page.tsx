"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { fmtDate } from "@/components/format";
import { Chip, Empty, ErrorBox, PageHeader, btn2Cls, inputCls, labelCls } from "@/components/ui";
import { get } from "@/lib/client";
import { typeLabel } from "@/lib/session-types";
import type { TimelineEntry } from "@/lib/types";

export default function TuteePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tutee, setTutee] = useState<{ id: number; first_name: string } | null>(null);
  const [sessions, setSessions] = useState<TimelineEntry[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    get<{ tutee: { id: number; first_name: string }; sessions: TimelineEntry[] }>(`/api/tutees/${id}`)
      .then((j) => { setTutee(j.tutee); setName(j.tutee.first_name); setSessions(j.sessions); })
      .catch((e) => setError((e as Error).message));
  }, [id]);

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/tutees/${id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ firstName: name }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not save.");
      setTutee((t) => (t ? { ...t, first_name: name.trim().split(/\s+/)[0] } : t));
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (error && !tutee) return <div className="space-y-4"><ErrorBox error={error} /><Link href="/tutees" className="inline-flex min-h-11 items-center text-indigo-700 underline">All tutees</Link></div>;
  if (!tutee) return <p className="text-stone-600">Loading…</p>;
  return (
    <div className="space-y-8">
      <Link href="/tutees" className="inline-flex min-h-10 items-center text-sm font-medium text-indigo-700 underline underline-offset-4">← Tutees</Link>
      <PageHeader title={tutee.first_name}>Every session with this student, newest first.</PageHeader>

      <section aria-labelledby="tl" className="space-y-3">
        <h2 id="tl" className="font-display text-[22px] text-ink">Timeline</h2>
        {sessions.length === 0 ? (
          <Empty title="No sessions yet">Sessions you log for {tutee.first_name} will show here.</Empty>
        ) : (
          <ol className="space-y-3">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link href={`/session/${s.id}`} className="flex min-h-12 flex-col gap-1.5 rounded-xl border border-stone-200 bg-white p-4 transition hover:border-stone-300">
                  <span className="font-semibold text-ink">{fmtDate(s.created_at)}{s.course ? ` · ${s.course}` : ""}</span>
                  <span className="flex flex-wrap gap-2 text-sm text-stone-600">
                    {s.type && <Chip>{typeLabel(s.type) || s.type}</Chip>}
                    {s.focus?.map((f) => <Chip key={f}>{f}</Chip>)}
                    {s.minutes ? <span>{s.minutes} min</span> : null}
                    {s.reflection ? <Chip tone="green">Reflection saved</Chip> : <Chip tone="gold">No reflection yet</Chip>}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <form onSubmit={rename} className="flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white p-5">
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="t-rename" className={labelCls}>First name</label>
          <input id="t-rename" className={inputCls} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </div>
        <button className={btn2Cls} disabled={!name.trim()}>Rename</button>
        {saved && <span role="status" className="text-sm text-stone-600">Saved.</span>}
      </form>
      {error && <ErrorBox error={error} />}
    </div>
  );
}
