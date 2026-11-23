"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { btn2Cls, btnCls, Chip, ErrorBox, Working } from "@/components/ui";
import { get, post } from "@/lib/client";
import { MIN_TO_RUN } from "@/lib/task-forces";

type TF = { key: string; name: string; max: number | null; scholars: boolean; description: string; count: number; members: string[]; full: boolean };
type Data = { taskForces: TF[]; mine: string | null };

/** The task force cards: join one, move, or leave. `onChange` reports the current choice. */
export default function TaskForcePicker({ onChange }: { onChange?: (mine: string | null) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const apply = useCallback((d: Data) => { setData(d); onChange?.(d.mine); }, [onChange]);
  useEffect(() => { get<Data>("/api/task-forces").then(apply).catch((e: Error) => setError(e.message)); }, [apply]);

  async function join(key: string) {
    setBusy(true);
    setError(null);
    try { apply(await post<Data>("/api/task-forces", { key })); router.refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function leave() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/task-forces", { method: "DELETE" });
      const json = await res.json().catch(() => ({ error: "The server sent an unreadable reply." }));
      if (!res.ok) throw new Error(json.error || "Request failed");
      apply(json as Data);
      router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  if (!data) return error ? <ErrorBox error={error} /> : <Working label="Loading" />;
  return (
    <div className="space-y-3">
      <ErrorBox error={error} />
      <ul className="grid gap-3 sm:grid-cols-2">
        {data.taskForces.map((t) => {
          const mine = data.mine === t.key;
          return (
            <li key={t.key} className={`flex flex-col gap-2 rounded-xl border-2 p-4 ${mine ? "border-ink bg-gold-50" : "border-stone-200 bg-white"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-xl text-ink">{t.name}</h3>
                {mine && <Chip tone="ink">Your task force</Chip>}
                {t.count < MIN_TO_RUN && !t.scholars && <Chip tone="gold">needs {MIN_TO_RUN} to run</Chip>}
              </div>
              <p className="text-sm text-stone-700">{t.description}</p>
              <p className="text-sm text-stone-600">{t.max === null ? `${t.count} placed` : `${t.count} of ${t.max} places taken`}{t.members.length > 0 && `: ${t.members.join(", ")}`}</p>
              <div className="mt-auto pt-1">
                {t.scholars ? (
                  <p className="text-sm text-stone-600">The director places experienced tutors here.</p>
                ) : mine ? (
                  <button type="button" className={`${btn2Cls} min-h-10`} disabled={busy} onClick={leave}>Leave</button>
                ) : (
                  <button type="button" className={`${btnCls} min-h-10`} disabled={busy || t.full} onClick={() => join(t.key)}>{t.full ? "Full" : data.mine ? "Move here" : "Join"}</button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
