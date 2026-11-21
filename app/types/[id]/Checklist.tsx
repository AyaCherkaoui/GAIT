"use client";
import { useState } from "react";
import type { Step } from "@/lib/session-types";

/** Checkbox state lives in memory only; nothing is saved. */
export default function Checklist({ title, steps }: { title: string; steps: Step[] }) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  return (
    <div>
      <h3 className="mb-2 font-medium text-stone-900">{title}</h3>
      <ul className="space-y-2 text-sm">
        {steps.map((s, i) => (
          <li key={i}>
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={!!done[i]} onChange={(e) => setDone({ ...done, [i]: e.target.checked })} />
              <span className={`break-words ${done[i] ? "text-stone-400 line-through" : ""}`}>
                {s.text}
                {s.link && (
                  <>
                    {" "}
                    <a className="text-indigo-700 underline" href={s.link.url} target="_blank" rel="noreferrer">{s.link.label}</a>
                  </>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
