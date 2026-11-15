"use client";
import { useEffect, useState } from "react";
import CopyButton from "@/components/CopyButton";
import { Empty, ErrorBox, PageHeader, Working, btn2Cls, btnCls, inputCls, labelCls } from "@/components/ui";
import { get, post } from "@/lib/client";
import type { TaskRecord } from "@/lib/types";

export default function TaskForcePage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => get<{ tasks: TaskRecord[] }>("/api/taskforce").then((j) => setTasks(j.tasks)).catch(() => {});
  useEffect(() => { load(); }, []);

  async function plan(e: React.FormEvent) {
    e.preventDefault();
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
          <textarea id="tf-desc" className={inputCls} rows={4} placeholder="Goal, audience, deadline, anything you were told" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <button className={`${btnCls} min-h-11`} disabled={loading}>Plan this task</button>
      </form>
      {loading && <Working label="Planning your task" />}
      <ErrorBox error={error} />
      {tasks.length === 0 && !loading && <Empty title="No tasks yet">Add a title and details above, then plan the task. Your plans will be saved here.</Empty>}
      {tasks.length > 0 && (
        <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
          {tasks.map((t) => {
            const open = openId === t.id;
            return (
              <li key={t.id}>
                <div className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
                  <h2 className="min-w-0 break-words font-display text-xl font-semibold text-ink">{t.title || "Untitled task"}</h2>
                  <button className={`${btn2Cls} min-h-10 shrink-0`} aria-expanded={open} onClick={() => setOpenId(open ? null : t.id)}>{open ? "Hide plan" : "Show plan"}</button>
                </div>
                {open && (
                  <div className="space-y-6 border-t border-stone-200 px-5 py-5 sm:px-6">
                    <section>
                      <h3 className="font-display text-lg font-semibold text-ink">Steps</h3>
                      <ol className="mt-2 max-w-prose list-decimal space-y-1.5 pl-6 text-[15px] marker:font-semibold marker:text-gold-600">{t.plan.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                    </section>
                    <section>
                      <div className="flex items-center gap-3"><h3 className="font-display text-lg font-semibold text-ink">Starting outline</h3><CopyButton text={t.plan.outline} /></div>
                      <pre className="mt-2 max-w-prose whitespace-pre-wrap rounded-md border border-gold-300/70 bg-gold-50 p-4 font-sans text-[15px] leading-relaxed">{t.plan.outline}</pre>
                    </section>
                    <section>
                      <h3 className="font-display text-lg font-semibold text-ink">Questions to ask the lead</h3>
                      <ul className="mt-2 max-w-prose list-disc space-y-1.5 pl-6 text-[15px]">{t.plan.questionsToClarify.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </section>
                    {t.related.length > 0 && (
                      <section>
                        <h3 className="font-display text-lg font-semibold text-ink">Related ARIA files</h3>
                        <ul className="mt-2 divide-y divide-stone-200 rounded-md border border-stone-200">
                          {t.related.map((h) => (
                            <li key={h.driveId} className="px-4 py-3">
                              <a className="break-words font-medium text-ink underline decoration-gold-400 decoration-2 underline-offset-4 hover:text-indigo-700" href={h.url} target="_blank" rel="noreferrer">{h.name}</a>
                              {h.reason && <p className="mt-0.5 max-w-prose text-sm italic text-stone-600">{h.reason}</p>}
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
