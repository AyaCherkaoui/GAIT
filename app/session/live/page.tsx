"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Eng101Panel from "@/components/Eng101Panel";
import SessionTimer, { elapsedMs, useLive } from "@/components/SessionTimer";
import { Chip, PageHeader, btn2Cls, btnBlueCls, inputCls, labelCls } from "@/components/ui";
import { approachFor, DRAFT_CHIP } from "@/lib/approaches";
import { readLocal, writeLocal } from "@/lib/local";
import { typeLabel } from "@/lib/session-types";
import { LIVE_KEY } from "@/components/SessionTimer";

const DRAFT_KEY = "ink-draft-session";

export default function LiveSession() {
  const router = useRouter();
  const { live, now, update, ready } = useLive();
  const [confirming, setConfirming] = useState(false);

  if (!ready) return null;
  if (!live) {
    return (
      <div className="space-y-6">
        <PageHeader title="Live session">No session is running.</PageHeader>
        <Link href="/" className="inline-flex min-h-11 items-center text-indigo-700 underline underline-offset-4">Start one from Home</Link>
      </div>
    );
  }

  const mins = Math.floor(elapsedMs(live, now) / 60_000);
  const approach = approachFor(live.type, live.focus);
  const current = approach.steps.reduce((c, s, i) => (s.at <= mins ? i : c), 0);

  function finish() {
    if (!live) return;
    let draft: Record<string, unknown> = {};
    try {
      draft = JSON.parse(readLocal(DRAFT_KEY) || "{}") || {};
    } catch {
      /* a broken draft is replaced */
    }
    const prevNotes = typeof draft.workedOn === "string" ? draft.workedOn : "";
    writeLocal(DRAFT_KEY, JSON.stringify({
      ...draft,
      studentName: live.firstName || (draft.studentName as string) || "",
      workedOn: [prevNotes, live.notes].filter((x) => x.trim()).join("\n"),
      sessionType: live.type,
      sessionFocus: live.focus.join(", "),
      sessionMinutes: String(Math.max(1, Math.round(elapsedMs(live) / 60_000))),
      tuteeId: live.tuteeId ? String(live.tuteeId) : "",
      fromLive: true,
    }));
    writeLocal(LIVE_KEY, null);
    router.push("/session");
  }

  function discard() {
    writeLocal(LIVE_KEY, null);
    writeLocal(DRAFT_KEY, null);
    router.push("/");
  }

  return (
    <div className="space-y-6">
      <PageHeader title={typeLabel(live.type)}>
        {live.firstName ? `With ${live.firstName}. ` : ""}{live.type === "aff" ? "No student is present, so the timer is a time budget." : "Keep the notes short; you can write them up after."}
      </PageHeader>
      <SessionTimer live={live} now={now} update={update} />

      {live.type === "eng101" && <Eng101Panel live={live} now={now} update={update} />}

      {live.type !== "eng101" && <section aria-labelledby="approach" className="space-y-3 rounded-xl border border-stone-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="approach" className="font-display text-[22px] text-ink">Approach</h2>
          <Chip tone="gold">{DRAFT_CHIP}</Chip>
        </div>
        {approach.tip && <p className="text-sm text-stone-600">{approach.tip}</p>}
        <ol className="space-y-2">
          {approach.steps.map((s, i) => (
            <li key={i} aria-current={i === current ? "step" : undefined} className={`flex gap-3 rounded-lg border px-4 py-3 ${i === current ? "border-ink bg-gold-50" : "border-stone-200"}`}>
              <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-stone-600">{s.at} min</span>
              <span className="text-ink">{s.text}</span>
            </li>
          ))}
        </ol>
      </section>}

      <div>
        <label htmlFor="live-notes" className={labelCls}>Notes</label>
        <textarea id="live-notes" className={`${inputCls} ruled`} rows={5} value={live.notes} onChange={(e) => update((l) => ({ ...l, notes: e.target.value }))} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={finish} className={btnBlueCls}>Finish and write it up</button>
        {!confirming && <button type="button" onClick={() => setConfirming(true)} className={btn2Cls}>Discard session</button>}
      </div>
      {confirming && (
        <div role="alertdialog" aria-labelledby="discard-q" className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <p id="discard-q" className="text-sm text-stone-800">Discard this session? The timer and your notes will be deleted and cannot be brought back.</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={discard} className={btn2Cls}>Yes, discard it</button>
            <button type="button" onClick={() => setConfirming(false)} className={btn2Cls}>Keep going</button>
          </div>
        </div>
      )}
    </div>
  );
}
