"use client";
import { useEffect, useState } from "react";
import { ErrorBox, btnCls, inputCls, labelCls } from "@/components/ui";
import { get } from "@/lib/client";

type NoteState = { note: string; updatedAt: string | null; canEdit: boolean };

/** The director's note on a session. Tutors read it; only the director can write it. Shows nothing for a tutor when there is no note. */
export default function DirectorNote({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<NoteState | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    get<NoteState>(`/api/session/${sessionId}/director-note`)
      .then((s) => { setState(s); setDraft(s.note); })
      .catch(() => setState(null));
  }, [sessionId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/session/${sessionId}/director-note`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ note: draft }) });
      const j = await res.json().catch(() => ({ error: "The server sent an unreadable reply." }));
      if (!res.ok) throw new Error(j.error || "Could not save.");
      setState((s) => (s ? { ...s, note: j.note, updatedAt: j.updatedAt } : s));
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!state || (!state.canEdit && !state.note)) return null;
  return (
    <section aria-labelledby="dnote" className="space-y-3 border-t border-stone-200 pt-6">
      <h2 id="dnote" className="font-display text-2xl font-semibold text-ink">Note from the director</h2>
      {state.canEdit ? (
        <form onSubmit={save} className="max-w-prose space-y-3">
          <div>
            <label htmlFor="director-note" className={labelCls}>Your note for the tutor</label>
            <textarea id="director-note" className={inputCls} rows={3} maxLength={2000} value={draft} onChange={(e) => { setDraft(e.target.value); setSaved(false); }} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className={`${btnCls} min-h-10`} disabled={busy}>Save note</button>
            {saved && <span role="status" className="text-sm text-stone-700">Saved.</span>}
          </div>
          <ErrorBox error={error} />
        </form>
      ) : (
        <p className="max-w-prose whitespace-pre-wrap rounded-lg border border-gold-300/70 bg-gold-50 p-4 text-[15px] text-stone-800">{state.note}</p>
      )}
    </section>
  );
}
