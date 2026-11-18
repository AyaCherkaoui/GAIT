"use client";
import { useEffect, useState } from "react";
import { clock, elapsedMs, type Live } from "@/components/SessionTimer";
import { Chip, ErrorBox, Working, btn2Cls, btnCls } from "@/components/ui";
import { get, post } from "@/lib/client";
import type { Unit } from "@/lib/courses";

type Exercise = { title: string; tasks: string[]; tutorNote: string };

/** English 101 mode of the live page: a unit stepper, a timer for the current unit, and an exercise made on demand. */
export default function Eng101Panel({ live, now, update }: { live: Live; now: number; update: (fn: (l: Live) => Live) => void }) {
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    get<{ units: Unit[] }>("/api/courses").then((c) => setUnits(c.units)).catch((e) => { setError((e as Error).message); setUnits([]); });
  }, []);

  if (units === null) return null;
  if (units.length === 0) {
    return (
      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="font-display text-[22px] text-ink">English 101 units</h2>
        <p className="mt-2 text-stone-600">The director has not set up the course yet. You can still keep notes below.</p>
        {error && <ErrorBox error={error} />}
      </section>
    );
  }

  const unit = Math.min(live.unit ?? 0, units.length - 1);
  const starts = live.unitStarts ?? [0];
  const inUnit = Math.max(0, elapsedMs(live, now) - (starts[unit] ?? 0));
  const u = units[unit];
  const go = (to: number) => {
    setExercise(null);
    update((l) => {
      const s = [...(l.unitStarts ?? [0])];
      s[to] = elapsedMs(l);
      return { ...l, unit: to, unitStarts: s };
    });
  };
  async function makeExercise() {
    setBusy(true); setError(null);
    try { setExercise(await post<Exercise>("/api/courses/exercise", { unit })); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <section aria-labelledby="units" className="space-y-4 rounded-xl border border-stone-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="units" className="font-display text-[22px] text-ink">English 101 units</h2>
        <Chip>Unit {unit + 1} of {units.length}</Chip>
      </div>
      <div>
        <p className="font-semibold text-ink">{u.title}</p>
        {u.goal && <p className="text-sm text-stone-600">{u.goal}</p>}
        <p role="timer" aria-label="Time in this unit" className="mt-2 text-sm tabular-nums text-stone-600">
          In this unit {clock(inUnit)} of {u.minutes}:00
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={btn2Cls} disabled={unit === 0} onClick={() => go(unit - 1)}>Previous unit</button>
        <button type="button" className={btn2Cls} disabled={unit >= units.length - 1} onClick={() => go(unit + 1)}>Next unit</button>
        <button type="button" className={btnCls} disabled={busy} onClick={makeExercise}>Give the tutee an exercise</button>
      </div>
      {busy && <Working label="Writing an exercise" />}
      {error && <ErrorBox error={error} />}
      {exercise && (
        <div className="space-y-2 rounded-lg border border-gold-300 bg-gold-50 p-4">
          <p className="font-semibold text-ink">{exercise.title}</p>
          <ol className="list-decimal space-y-1 pl-5 text-ink">{exercise.tasks.map((t, i) => <li key={i}>{t}</li>)}</ol>
          {exercise.tutorNote && <p className="text-sm text-stone-600">Listen for: {exercise.tutorNote}</p>}
        </div>
      )}
    </section>
  );
}
