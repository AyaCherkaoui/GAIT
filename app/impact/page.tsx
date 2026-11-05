"use client";
import { useEffect, useState } from "react";
import { Card, ErrorBox } from "@/components/ui";
import { get } from "@/lib/client";
import type { ImpactWeek } from "@/lib/impact";

export default function ImpactPage() {
  const [weeks, setWeeks] = useState<ImpactWeek[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { get<{ weeks: ImpactWeek[] }>("/api/impact").then((j) => setWeeks(j.weeks)).catch((e) => setError(e.message)); }, []);
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Impact snapshot</h1>
          <p className="text-sm text-slate-600">Anonymous weekly counts. No names and no text, and nothing about individual tutors.</p>
        </div>
        <a className="text-sm text-indigo-700 underline" href="/api/impact?format=csv">Download CSV</a>
      </div>
      <ErrorBox error={error} />
      <Card title="By week">
        {!weeks || weeks.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing counted yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th>Week of</th><th>Sessions</th><th>AI use disclosed</th><th>Allowed</th><th>Limited</th><th>Banned</th><th>Unknown</th><th>Ownership Qs</th><th>Scripts</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.week}><td>{w.week}</td><td>{w.sessions}</td><td>{w.aiDisclosed}</td><td>{w.allowed}</td><td>{w.limited}</td><td>{w.banned}</td><td>{w.unknown}</td><td>{w.ownership}</td><td>{w.scripts}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
