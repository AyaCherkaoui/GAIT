"use client";
import { useEffect, useState } from "react";
import { Card, ErrorBox, PageHeader, Working, btn2Cls, btnCls, inputCls, labelCls } from "@/components/ui";
import { get, post } from "@/lib/client";
import type { Unit } from "@/lib/courses";
import type { Hit } from "@/lib/types";

type Course = { syllabus: string; units: Unit[]; updated_at: string | null };

export default function CoursesClient() {
  const [syllabus, setSyllabus] = useState("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState<"" | "search" | "load" | "propose" | "save">("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    get<Course>("/api/courses").then((c) => { setSyllabus(c.syllabus); setUnits(c.units); }).catch((e) => setError((e as Error).message));
  }, []);

  async function run(kind: typeof busy, fn: () => Promise<void>) {
    setBusy(kind); setError(null); setSaved(false);
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }
  const search = () => run("search", async () => setHits((await post<{ hits: Hit[] }>("/api/search", { q })).hits));
  const load = (driveId: string) => run("load", async () => setSyllabus((await post<{ syllabus: string }>("/api/courses/load", { driveId })).syllabus));
  const propose = () => run("propose", async () => setUnits((await post<{ units: Unit[] }>("/api/courses/propose", { syllabus })).units));
  const save = () => run("save", async () => {
    const res = await fetch("/api/courses", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ syllabus, units }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "Could not save.");
    setSaved(true);
  });
  const edit = (i: number, patch: Partial<Unit>) => setUnits((us) => us.map((u, k) => (k === i ? { ...u, ...patch } : u)));

  return (
    <div className="space-y-8">
      <PageHeader title="English 101">One course shared by every tutor. Load the syllabus, let the AI propose units, edit them, then save.</PageHeader>
      {error && <ErrorBox error={error} />}

      <Card>
        <h2 className="font-display text-[22px] text-ink">1. The syllabus</h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="c-search" className={labelCls}>Find it in ARIA</label>
            <input id="c-search" className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="English 101 syllabus" />
          </div>
          <button type="button" className={btn2Cls} disabled={!q.trim() || busy !== ""} onClick={search}>Search ARIA</button>
        </div>
        {busy === "search" && <Working label="Searching" />}
        {hits.length > 0 && (
          <ul className="mt-3 space-y-2">
            {hits.map((h) => (
              <li key={h.driveId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 p-3">
                <span className="text-sm text-ink">{h.name}</span>
                <button type="button" className={btn2Cls} disabled={busy !== ""} onClick={() => load(h.driveId)}>Use this</button>
              </li>
            ))}
          </ul>
        )}
        <label htmlFor="c-syllabus" className={`${labelCls} mt-5`}>Or paste it here</label>
        <textarea id="c-syllabus" rows={8} className={inputCls} value={syllabus} onChange={(e) => setSyllabus(e.target.value)} />
        <button type="button" className={`${btnCls} mt-3`} disabled={!syllabus.trim() || busy !== ""} onClick={propose}>Propose units</button>
        {busy === "propose" && <Working label="Reading the syllabus" />}
      </Card>

      <Card>
        <h2 className="font-display text-[22px] text-ink">2. The units</h2>
        {units.length === 0 ? (
          <p className="mt-3 text-stone-600">No units yet.</p>
        ) : (
          <ol className="mt-4 space-y-4">
            {units.map((u, i) => (
              <li key={i} className="grid gap-3 rounded-lg border border-stone-200 p-4 sm:grid-cols-[1fr_6rem]">
                <div>
                  <label htmlFor={`u-title-${i}`} className={labelCls}>Unit {i + 1} title</label>
                  <input id={`u-title-${i}`} className={inputCls} value={u.title} maxLength={120} onChange={(e) => edit(i, { title: e.target.value })} />
                </div>
                <div>
                  <label htmlFor={`u-min-${i}`} className={labelCls}>Minutes</label>
                  <input id={`u-min-${i}`} type="number" min={5} max={180} className={inputCls} value={u.minutes} onChange={(e) => edit(i, { minutes: Number(e.target.value) })} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor={`u-goal-${i}`} className={labelCls}>Goal</label>
                  <input id={`u-goal-${i}`} className={inputCls} value={u.goal} maxLength={400} onChange={(e) => edit(i, { goal: e.target.value })} />
                </div>
                <button type="button" className={`${btn2Cls} sm:col-span-2 sm:justify-self-start`} onClick={() => setUnits((us) => us.filter((_, k) => k !== i))}>Remove unit {i + 1}</button>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className={btn2Cls} disabled={units.length >= 20} onClick={() => setUnits((us) => [...us, { title: "", goal: "", minutes: 20 }])}>Add a unit</button>
          <button type="button" className={btnCls} disabled={busy !== ""} onClick={save}>Save course</button>
          {saved && <span role="status" className="text-sm text-stone-600">Saved.</span>}
        </div>
      </Card>
    </div>
  );
}
