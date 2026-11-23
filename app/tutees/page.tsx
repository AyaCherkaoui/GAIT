"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fmtDate } from "@/components/format";
import { Empty, ErrorBox, PageHeader, btnCls, inputCls, labelCls } from "@/components/ui";
import { get, post } from "@/lib/client";
import type { Tutee } from "@/lib/types";

export default function TuteesPage() {
  const [tutees, setTutees] = useState<Tutee[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const load = () => get<{ tutees: Tutee[] }>("/api/tutees").then((j) => setTutees(j.tutees)).catch((e) => { setError((e as Error).message); setTutees([]); });
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await post("/api/tutees", { firstName: name });
      setName("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Tutees">The students you work with, by first name. Only you can see this list.</PageHeader>
      <form onSubmit={add} className="flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white p-5">
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="t-name" className={labelCls}>Add a tutee (first name)</label>
          <input id="t-name" className={inputCls} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </div>
        <button className={btnCls} disabled={!name.trim()}>Add</button>
      </form>
      {error && <ErrorBox error={error} />}
      {tutees === null ? (
        <p className="text-stone-600">Loading…</p>
      ) : tutees.length === 0 ? (
        <Empty title="No tutees yet">Log a session or add a first name above.</Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {tutees.map((t) => (
            <li key={t.id}>
              <Link href={`/tutees/${t.id}`} className="flex min-h-12 flex-col gap-1 rounded-xl border border-stone-200 bg-white p-4 transition hover:border-stone-300">
                <span className="font-semibold text-ink">{t.first_name}</span>
                <span className="text-sm text-stone-600">{t.sessions} {t.sessions === 1 ? "session" : "sessions"}{t.last_at ? ` · last ${fmtDate(t.last_at)}` : ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
