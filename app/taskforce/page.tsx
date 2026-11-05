"use client";
import { useEffect, useState } from "react";
import CopyButton from "@/components/CopyButton";
import { Card, ErrorBox, btnCls, inputCls } from "@/components/ui";
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
      <h1 className="text-2xl font-bold">Task force</h1>
      <form onSubmit={plan} className="space-y-3">
        <input className={inputCls} placeholder="Task title (e.g. Plan a citation workshop for first-years)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className={inputCls} rows={4} placeholder="Paste the task details: goal, audience, deadline…" value={description} onChange={(e) => setDescription(e.target.value)} />
        <button className={btnCls} disabled={loading}>{loading ? "Planning…" : "Help me plan it"}</button>
      </form>
      <ErrorBox error={error} />
      <div className="space-y-3">
        {tasks.map((t) => (
          <Card key={t.id} title={t.title || "Untitled task"} actions={
            <button className="text-sm text-indigo-700" onClick={() => setOpenId(openId === t.id ? null : t.id)}>{openId === t.id ? "Hide" : "Open"}</button>
          }>
            {openId === t.id && (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium">Steps</p>
                  <ol className="list-decimal pl-5">{t.plan.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                </div>
                <div>
                  <div className="flex items-center gap-2"><p className="font-medium">Starting outline</p><CopyButton text={t.plan.outline} /></div>
                  <pre className="whitespace-pre-wrap rounded bg-slate-50 p-2 font-sans">{t.plan.outline}</pre>
                </div>
                <div>
                  <p className="font-medium">Questions to ask the lead</p>
                  <ul className="list-disc pl-5">{t.plan.questionsToClarify.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
                {t.related.length > 0 && (
                  <div>
                    <p className="font-medium">Related ARIA files</p>
                    <ul className="list-disc pl-5">
                      {t.related.map((h) => (
                        <li key={h.driveId}><a className="text-indigo-700 underline" href={h.url} target="_blank" rel="noreferrer">{h.name}</a>{h.reason ? ` · ${h.reason}` : ""}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
