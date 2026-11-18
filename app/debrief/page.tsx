"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Empty, ErrorBox, Loading, PageHeader, btnCls, inputCls, labelCls, submitOnCmdEnter } from "@/components/ui";
import { get, post } from "@/lib/client";

type Week = { week: string; shifts: number; avg: number; draining: number };

export default function DebriefPage() {
  const [drain, setDrain] = useState(0);
  const [note, setNote] = useState("");
  const [weeks, setWeeks] = useState<Week[] | null>(null);
  const [nudge, setNudge] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    get<{ weeks: Week[]; nudge: boolean }>("/api/debrief")
      .then((j) => { setWeeks(j.weeks); setNudge(j.nudge); })
      .catch((e) => setError((e as Error).message));
  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post("/api/debrief", { drain, note });
      setDrain(0);
      setNote("");
      setSaved(true);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="30-second debrief">
        Private to you. No one else can read it, the director included, and no one reviews it.
      </PageHeader>
      <Card title="How draining was this shift?">
        <form onSubmit={save} className="max-w-prose space-y-4">
          <div role="group" aria-label="Drain rating, 1 easy to 5 draining" className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-stone-600">Easy</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={drain === n}
                onClick={() => { setDrain(n); setSaved(false); }}
                className={`h-11 w-11 rounded-md border text-sm font-semibold transition ${drain === n ? "border-ink bg-ink text-white" : "border-stone-300 bg-white text-stone-800 hover:bg-stone-100"}`}
              >
                {n}
              </button>
            ))}
            <span className="text-sm text-stone-600">Draining</span>
          </div>
          <div>
            <label htmlFor="debrief-note" className={labelCls}>One line: what stuck with you? (optional)</label>
            <input id="debrief-note" className={inputCls} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={submitOnCmdEnter} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className={`${btnCls} min-h-11`} disabled={!drain || busy}>{busy ? "Saving…" : "Save"}</button>
            {!drain && <span className="text-sm text-stone-600">Pick a number first.</span>}
            {saved && <span role="status" className="text-sm text-stone-700">Saved. Thanks for checking in. <Link href="/" className="font-medium text-indigo-700 underline underline-offset-4">Back to Today</Link></span>}
          </div>
        </form>
      </Card>
      <ErrorBox error={error} />
      {nudge && (
        <p className="rounded-lg border border-gold-300/70 bg-gold-50 p-4 text-[15px] text-stone-800">
          This has been a heavy week: 3 or more draining shifts. It might help to talk it over with the RWC director.
        </p>
      )}
      <Card title="Your weeks">
        {weeks === null ? (
          error ? <p className="text-sm text-stone-600">Your weeks could not be loaded.</p> : <Loading />
        ) : weeks.length === 0 ? (
          <Empty title="No debriefs yet">Your check-ins will show here, by week.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[22rem] text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-stone-600">
                  <th scope="col" className="py-2 pr-4 font-semibold">Week of</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Shifts</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Average</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Draining (4-5)</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.week} className="border-b border-stone-100 text-stone-800">
                    <td className="py-2 pr-4">{w.week}</td><td className="py-2 pr-4">{w.shifts}</td><td className="py-2 pr-4">{w.avg}</td><td className="py-2 pr-4">{w.draining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
