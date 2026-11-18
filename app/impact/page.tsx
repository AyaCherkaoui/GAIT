"use client";
import { useEffect, useState } from "react";
import { Card, Empty, ErrorBox, PageHeader, btn2Cls } from "@/components/ui";
import { get } from "@/lib/client";
import type { ImpactWeek } from "@/lib/impact";

const COLS: [keyof ImpactWeek, string][] = [
  ["week", "Week of"], ["sessions", "Sessions"], ["aiDisclosed", "AI use disclosed"], ["allowed", "Allowed"], ["limited", "Limited"],
  ["banned", "Banned"], ["unknown", "Unknown"], ["ownership", "Ownership questions"], ["scripts", "Script bank"],
];

export default function ImpactPage() {
  const [weeks, setWeeks] = useState<ImpactWeek[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    get<{ weeks: ImpactWeek[] }>("/api/impact").then((j) => setWeeks(j.weeks)).catch((e) => setError((e as Error).message));
  }, []);
  const sum = (k: keyof ImpactWeek) => (weeks ?? []).reduce((t, w) => t + Number(w[k]), 0);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Impact snapshot"
        actions={<a className={btn2Cls} href="/api/impact?format=csv" download>Download CSV</a>}
      >
        A plain count of what is happening across the center. It has no student names, no tutor names and no notes.
      </PageHeader>
      <ErrorBox error={error} />
      {!error && weeks === null && <p className="text-sm text-stone-600">Loading…</p>}
      {weeks && weeks.length === 0 && <Empty title="Nothing counted yet">Counts appear here once tutors write up sessions. Nothing here ever shows a student or tutor name.</Empty>}
      {weeks && weeks.length > 0 && (
        <>
          <section aria-label="Totals" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [sum("sessions"), "Sessions written up", "All weeks together."],
              [sum("aiDisclosed"), "Sessions where AI use came up", "The student said how they used AI."],
              [sum("banned") + sum("limited"), "Sessions in classes that limit or ban AI", "A good moment for the AI talk."],
              [sum("ownership") + sum("scripts"), "Times tutors used the AI talk tools", "Ownership questions and the script bank."],
            ].map(([n, label, hint]) => (
              <div key={label as string} className="rounded-xl border border-stone-200 bg-white p-5">
                <p className="font-display text-5xl tabular-nums text-ink">{n}</p>
                <p className="mt-2 text-[15px] font-semibold text-ink">{label}</p>
                <p className="text-sm text-stone-600">{hint}</p>
              </div>
            ))}
          </section>
          <Card title="Week by week">
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-[13px] text-stone-600">
                    {COLS.map(([k, label]) => <th key={k} scope="col" className="py-2 pr-4 font-semibold">{label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((w) => (
                    <tr key={w.week} className="border-b border-stone-100 text-stone-800">
                      {COLS.map(([k]) => <td key={k} className="py-2 pr-4 tabular-nums">{w[k]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
