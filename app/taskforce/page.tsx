"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import CopyButton from "@/components/CopyButton";
import { Chip, Empty, ErrorBox, Loading, PageHeader, Working, btn2Cls, btnCls, inputCls, labelCls, submitOnCmdEnter } from "@/components/ui";
import { get, post } from "@/lib/client";
import type { TaskRecord } from "@/lib/types";

const h3 = "font-display text-lg font-semibold text-ink";

function Plan({ t, onChange }: { t: TaskRecord; onChange: (done: number[]) => void }) {
  const done = t.plan.done ?? [];
  const [err, setErr] = useState<string | null>(null);
  async function toggle(i: number) {
    const next = done.includes(i) ? done.filter((x) => x !== i) : [...done, i];
    onChange(next);
    setErr(null);
    try {
      await fetch("/api/taskforce", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: t.id, done: next }) }).then((r) => { if (!r.ok) throw new Error("Could not save your progress."); });
    } catch (e) {
      setErr((e as Error).message);
      onChange(done);
    }
  }
  return (
    <div className="space-y-6 border-t border-stone-200 px-5 py-5 sm:px-6">
      <section>
        <h3 className={h3}>Steps <span className="text-sm font-normal text-stone-600">({done.length} of {t.plan.steps.length} done)</span></h3>
        <ul className="mt-2 max-w-prose space-y-1">
          {t.plan.steps.map((s, i) => (
            <li key={i}>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-1 py-2 text-[15px] hover:bg-stone-50">
                <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-indigo-700" checked={done.includes(i)} onChange={() => toggle(i)} />
                <span className={done.includes(i) ? "text-stone-500 line-through" : ""}>{s}</span>
              </label>
            </li>
          ))}
        </ul>
        <ErrorBox error={err} />
      </section>
      <section>
        <div className="flex items-center gap-3"><h3 className={h3}>Starting outline</h3><CopyButton text={t.plan.outline} label="Copy outline" /></div>
        <pre className="mt-2 max-w-prose whitespace-pre-wrap rounded-md border border-gold-300/70 bg-gold-50 p-4 font-sans text-[15px] leading-relaxed">{t.plan.outline}</pre>
      </section>
      <section>
        <div className="flex items-center gap-3"><h3 className={h3}>Questions to ask the lead</h3><CopyButton text={t.plan.questionsToClarify.join("\n")} label="Copy questions" /></div>
        <ul className="mt-2 max-w-prose list-disc space-y-1.5 pl-6 text-[15px]">{t.plan.questionsToClarify.map((s, i) => <li key={i}>{s}</li>)}</ul>
      </section>
      <section>
        <h3 className={h3}>Related ARIA files</h3>
        {t.related.length === 0 ? (
          <p className="mt-1 text-sm text-stone-600">No related files found. <Link className="font-medium text-indigo-700 underline underline-offset-4" href="/search">Search ARIA yourself</Link>.</p>
        ) : (
          <ul className="mt-2 divide-y divide-stone-200 rounded-md border border-stone-200">
            {t.related.map((h) => (
              <li key={h.driveId} className="px-4 py-3">
                <a className="inline-flex min-h-11 items-center break-words font-medium text-ink underline decoration-gold-400 decoration-2 underline-offset-4 hover:text-indigo-700" href={h.url} target="_blank" rel="noreferrer">{h.name}</a>
                {h.reason && <p className="mt-0.5 max-w-prose text-sm italic text-stone-600">{h.reason}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function TaskForcePage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tasks, setTasks] = useState<TaskRecord[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => get<{ tasks: TaskRecord[] }>("/api/taskforce").then((j) => setTasks(j.tasks)).catch((e) => { setTasks((t) => t ?? []); setError((e as Error).message); });
  useEffect(() => { load(); }, []);

  async function plan(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() && !description.trim()) { setError("Describe the task first."); return; }
    setLoading(true);
    setError(null);
    try {
      const r = await post<{ id: number }>("/api/taskforce", { title, description });
      await load();
      setOpenId(r.id);
      setTitle("");
      setDescription("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const setDone = (id: number, done: number[]) => setTasks((ts) => ts && ts.map((t) => (t.id === id ? { ...t, plan: { ...t.plan, done } } : t)));

  return (
    <div className="space-y-6">
      <PageHeader title="Task force">Turn an assignment into steps, an outline and questions to ask.</PageHeader>
      <form onSubmit={plan} className="max-w-3xl space-y-4">
        <div>
          <label htmlFor="tf-title" className={labelCls}>Task title</label>
          <input id="tf-title" className={`${inputCls} min-h-11`} placeholder="For example, plan a citation workshop for first-years" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label htmlFor="tf-desc" className={labelCls}>Task details</label>
          <textarea id="tf-desc" className={inputCls} rows={4} placeholder="Goal, audience, deadline, anything you were told" value={description} onChange={(e) => setDescription(e.target.value)} onKeyDown={submitOnCmdEnter} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className={`${btnCls} min-h-11`} disabled={loading}>Plan this task</button>
          <span className="text-sm text-stone-600">Ctrl or Cmd + Enter also works.</span>
        </div>
      </form>
      {loading && <Working label="Planning your task" />}
      <ErrorBox error={error} />
      {tasks === null && <Loading />}
      {tasks && tasks.length === 0 && !loading && <Empty title="No tasks yet">Add a title and details above, then plan the task. Your plans will be saved here.</Empty>}
      {tasks && tasks.length > 0 && (
        <section aria-label="Your tasks" className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-ink">Your tasks</h2>
          <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
            {tasks.map((t) => {
              const open = openId === t.id;
              const n = (t.plan.done ?? []).length;
              return (
                <li key={t.id}>
                  <div className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
                    <div className="min-w-0">
                      <h3 className="break-words font-display text-xl font-semibold text-ink">{t.title || "Untitled task"}</h3>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-stone-600">{t.created_at.slice(0, 10)} <Chip tone={n === t.plan.steps.length && n > 0 ? "gold" : "plain"}>{n} of {t.plan.steps.length} steps done</Chip></p>
                    </div>
                    <button className={`${btn2Cls} min-h-10 shrink-0`} aria-expanded={open} onClick={() => setOpenId(open ? null : t.id)}>{open ? "Hide" : "Reopen"}</button>
                  </div>
                  {open && <Plan t={t} onChange={(d) => setDone(t.id, d)} />}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
