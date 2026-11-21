import Link from "next/link";
import { Chip } from "@/components/ui";
import { getDb } from "@/lib/db";
import { listTaskForces } from "@/lib/task-force-data";
import { MIN_TO_RUN } from "@/lib/task-forces";

/** Home card for a tutor who has joined a task force: who is in it and the tutor's latest tasks for it. */
export default function MyTaskForceCard({ userId }: { userId: number }) {
  const { taskForces, mine } = listTaskForces(userId);
  const tf = taskForces.find((t) => t.key === mine);
  if (!tf) return null;
  const tasks = getDb().prepare("SELECT id, title FROM tasks WHERE user_id = ? AND task_force = ? ORDER BY id DESC LIMIT 3").all(userId, tf.key) as { id: number; title: string }[];
  return (
    <section aria-labelledby="your-task-force" className="flex flex-col gap-3">
      <h2 id="your-task-force" className="font-display text-[22px] text-ink">Your task force</h2>
      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <p className="flex flex-wrap items-center gap-2"><span className="text-base font-semibold text-ink">{tf.name}</span>{tf.count < MIN_TO_RUN && <Chip tone="gold">needs {MIN_TO_RUN} to run</Chip>}</p>
        <p className="mt-1 text-sm text-stone-600">Members: {tf.members.join(", ")}</p>
        {tasks.length > 0 ? (
          <ul className="mt-3 space-y-1 text-sm">{tasks.map((t) => <li key={t.id}>{t.title || "Untitled task"}</li>)}</ul>
        ) : (
          <p className="mt-3 text-sm text-stone-600">No tasks yet. <Link href="/taskforce" className="font-medium text-indigo-600 underline">Plan one</Link>.</p>
        )}
      </div>
    </section>
  );
}
