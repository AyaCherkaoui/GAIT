"use client";
import { useState } from "react";
import { Chip } from "@/components/ui";
import { DRAFT_CHIP } from "@/lib/approaches";
import { CHECKLISTS, type SessionType } from "@/lib/session-types";

const GROUPS = [["before", "Before"], ["during", "During"], ["after", "After"]] as const;

/** The handbook checklist for this kind of session. Ticks live in memory only; nothing is saved. */
export default function SessionChecklist({ type }: { type: SessionType }) {
  const list = CHECKLISTS[type];
  const [done, setDone] = useState<Record<string, boolean>>({});
  return (
    <section aria-labelledby="checklist" className="space-y-4 rounded-xl border border-stone-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="checklist" className="font-display text-[22px] text-ink">Handbook checklist</h2>
        <Chip tone="gold">{DRAFT_CHIP}</Chip>
      </div>
      {GROUPS.map(([key, title]) => (
        <details key={key} open={key === "before"} className="rounded-lg border border-stone-200 px-4 py-3">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-ink">{title}</summary>
          <ul className="mt-2 space-y-1">
            {list[key].map((s, i) => {
              const id = `${key}-${i}`;
              return (
                <li key={id}>
                  <label className="flex min-h-11 items-start gap-3 py-2 text-sm">
                    <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={!!done[id]} onChange={(e) => setDone({ ...done, [id]: e.target.checked })} />
                    <span className={`break-words ${done[id] ? "text-stone-500 line-through" : "text-ink"}`}>
                      {s.text}
                      {s.link && <> <a className="text-indigo-700 underline underline-offset-2" href={s.link.url} target="_blank" rel="noreferrer">{s.link.label}</a></>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </details>
      ))}
      <p className="text-sm text-stone-700"><span className="font-semibold text-ink">If the student does not come:</span> {list.noShow}</p>
      <p className="text-sm text-stone-700"><span className="font-semibold text-ink">Starfish:</span> {list.starfish}</p>
    </section>
  );
}
