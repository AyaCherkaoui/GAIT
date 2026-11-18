"use client";
import { useRef, useState } from "react";
import { ErrorBox, PageHeader, Working, btnBlueCls, inputCls, labelCls } from "@/components/ui";
import { post } from "@/lib/client";

type Msg = { role: "user" | "assistant"; content: string };

const STARTERS = ["I don't know how to start my paper.", "How do I know if my thesis is clear?", "How can I use AI to revise without it writing for me?"];

export default function CoachPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setDraft("");
    setBusy(true);
    setError(null);
    try {
      const { answer } = await post<{ answer: string }>("/api/coach", { messages: next.slice(-10) });
      setMessages([...next, { role: "assistant", content: answer }]);
      setTimeout(() => end.current?.scrollIntoView({ block: "nearest" }), 50);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Ask the coach">
        Ask about your writing process: getting started, planning, revising. The coach answers with tips and questions. It will not write your paper. Nothing you type here is saved.
      </PageHeader>
      {messages.length === 0 && (
        <section aria-labelledby="try" className="space-y-2">
          <h2 id="try" className="font-display text-[22px] text-ink">Try one of these</h2>
          <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {STARTERS.map((s) => (
              <li key={s}>
                <button type="button" className="min-h-11 w-full rounded-full border border-stone-200 bg-white px-4 py-2 text-left text-sm font-medium text-stone-800 hover:border-stone-400 hover:bg-stone-100 sm:w-auto" onClick={() => send(s)} disabled={busy}>{s}</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {messages.length > 0 && (
        <ol aria-label="Conversation" className="space-y-3">
          {messages.map((m, i) => (
            <li key={i} className={`max-w-prose whitespace-pre-wrap rounded-xl p-4 text-[15px] ${m.role === "user" ? "ml-auto bg-ink text-white" : "border border-stone-200 bg-white text-stone-800"}`}>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide opacity-70">{m.role === "user" ? "You" : "Coach"}</span>
              {m.content}
            </li>
          ))}
        </ol>
      )}
      {busy && <Working label="The coach is thinking" />}
      <ErrorBox error={error} />
      <form onSubmit={(e) => { e.preventDefault(); send(draft); }} className="max-w-prose space-y-3">
        <div>
          <label htmlFor="coach-q" className={labelCls}>{messages.length ? "Your reply" : "Your question"}</label>
          <textarea id="coach-q" className={`${inputCls} ruled`} rows={3} maxLength={2000} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="I have a history paper due Friday and I'm stuck on the introduction." />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className={`${btnBlueCls} min-h-11`} disabled={busy || !draft.trim()}>Ask the coach</button>
          {messages.length > 0 && <button type="button" className="min-h-11 text-sm text-stone-700 underline underline-offset-4" onClick={() => { setMessages([]); setError(null); }}>Start over</button>}
        </div>
      </form>
      <div ref={end} />
    </div>
  );
}
