"use client";
import { useEffect, useState } from "react";
import { Card, ErrorBox, btnCls, inputCls } from "@/components/ui";
import { get, post } from "@/lib/client";

type Week = { week: string; shifts: number; avg: number; draining: number };

export default function DebriefPage() {
  const [drain, setDrain] = useState(0);
  const [note, setNote] = useState("");
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [nudge, setNudge] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => get<{ weeks: Week[]; nudge: boolean }>("/api/debrief").then((j) => { setWeeks(j.weeks); setNudge(j.nudge); }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await post("/api/debrief", { drain, note });
      setDrain(0); setNote(""); setSaved(true);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">30-second debrief</h1>
        <p className="text-sm text-slate-600">Private to you. It is saved on this computer, never shared or exported, and no one reviews it.</p>
      </div>
      <Card title="How draining was this shift?">
        <form onSubmit={save} className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Easy</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => { setDrain(n); setSaved(false); }} className={`h-9 w-9 rounded border ${drain === n ? "bg-indigo-600 text-white" : "border-slate-300"}`}>{n}</button>
            ))}
            <span className="text-slate-500">Draining</span>
          </div>
          <input className={inputCls} placeholder="One line: what stuck with you? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className={btnCls} disabled={!drain}>Save</button>
          {saved && <p className="text-slate-600">Saved. Thanks for checking in.</p>}
        </form>
      </Card>
      <ErrorBox error={error} />
      {nudge && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          This has been a heavy week: 3 or more draining shifts. It might help to talk it over with the RWC director.
        </p>
      )}
      <Card title="Your weeks">
        {weeks.length === 0 ? (
          <p className="text-sm text-slate-500">No debriefs yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500"><th>Week of</th><th>Shifts</th><th>Average</th><th>Draining (4-5)</th></tr></thead>
            <tbody>{weeks.map((w) => <tr key={w.week}><td>{w.week}</td><td>{w.shifts}</td><td>{w.avg}</td><td>{w.draining}</td></tr>)}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
