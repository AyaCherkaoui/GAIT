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
  return (
    <div className="space-y-6">
      <PageHeader
        title="Impact snapshot"
        actions={<a className={btn2Cls} href="/api/impact?format=csv" download>Download CSV</a>}
      >
        Anonymous weekly counts for the whole center. No names and no text, and nothing about individual tutors.
      </PageHeader>
      <ErrorBox error={error} />
      {!error && weeks === null && <p className="text-sm text-stone-600">Loading…</p>}
      {weeks && (
        <Card title="By week">
          {weeks.length === 0 ? (
            <Empty title="Nothing counted yet">Counts appear here as tutors log sessions.</Empty>
          ) : (
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-600">
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
          )}
        </Card>
      )}
    </div>
  );
}
