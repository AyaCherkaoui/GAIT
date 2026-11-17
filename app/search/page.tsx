"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { get, post } from "@/lib/client";
import type { Hit } from "@/lib/types";
import type { FocusDoc } from "@/components/AriaMap";

const EXAMPLES = [
  "A handout on integrating quotes for ESL students",
  "How do I help a student who only wants proofreading?",
  "Templates for a thesis statement",
  "Citation help for MLA and APA",
];
const STAGES = ["searching keywords", "matching files", "picking the best 5"];
const RECENT_KEY = "ink-recent-searches";
const AriaMap = dynamic(() => import("@/components/AriaMap"), { ssr: false });

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}

function Stage() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const a = setTimeout(() => setStage(1), 2500);
    const b = setTimeout(() => setStage(2), 6000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  return (
    <p role="status" className="flex items-center gap-2.5 border-t border-white/10 px-4 py-3 text-sm text-indigo-100">
      <span className="h-2 w-2 shrink-0 animate-ping rounded-full bg-gold-300" />
      Searching ARIA: {STAGES[stage]}…
    </p>
  );
}

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [docs, setDocs] = useState<number | null>(null);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [asked, setAsked] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [related, setRelated] = useState<string[]>([]);
  const [focusKey, setFocusKey] = useState(0);
  const [focusDoc, setFocusDoc] = useState<FocusDoc>(null);
  const [focused, setFocused] = useState(true);
  const [open, setOpen] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);
  const box = useRef<HTMLInputElement>(null);

  useEffect(() => {
    box.current?.focus();
    setRecent(readRecent());
    get<{ docs: number }>("/api/search").then((j) => setDocs(j.docs)).catch(() => {});
  }, []);

  async function run(question: string) {
    const text = question.trim();
    if (!text || loading) return;
    setQ(text);
    setLoading(true);
    setError(null);
    setHits(null);
    setPicked(null);
    setFocused(false);
    box.current?.blur();
    try {
      const r = await post<{ hits: Hit[]; terms: string[]; indexEmpty: boolean; related?: string[] }>("/api/search", { q: text });
      setRelated(r.related || []);
      setFocusKey((k) => k + 1);
      if (r.indexEmpty) setError("The ARIA index is empty. Run npm run sync-aria first (see AGENTS.md).");
      setHits(r.hits);
      setAsked(text);
      setOpen(true);
      const next = [text, ...readRecent().filter((x) => x !== text)].slice(0, 5);
      setRecent(next);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setQ("");
    setHits(null);
    setRelated([]);
    setError(null);
    setPicked(null);
    box.current?.focus();
  }

  const pick = (h: Hit) => { setPicked(h.driveId); setFocusDoc({ id: h.driveId, key: Date.now() }); };
  const chip = "rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-left text-sm text-indigo-50 transition hover:border-gold-300/60 hover:bg-white/10";
  const showIdeas = focused && !q.trim() && !loading;

  const panel = (
    <div
      className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1736]/90 text-white shadow-[0_18px_50px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md"
      onFocus={() => setFocused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false); }}
    >
      <form role="search" onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex items-center gap-1.5 p-1.5 pl-3.5">
        <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-indigo-300" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" strokeLinecap="round" /></svg>
        <label htmlFor="aria-q" className="sr-only">Describe the file you are looking for</label>
        <input
          id="aria-q"
          ref={box}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape" && q) { e.preventDefault(); clear(); } }}
          placeholder="Describe what you need…"
          autoComplete="off"
          enterKeyHint="search"
          className="h-11 min-w-0 flex-1 bg-transparent px-1.5 text-base text-white placeholder:text-indigo-300/80 focus:outline-none"
        />
        {q && !loading && (
          <button type="button" onClick={clear} aria-label="Clear search" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-indigo-200 hover:bg-white/10 hover:text-white">✕</button>
        )}
        <button disabled={loading || !q.trim()} className="h-10 shrink-0 rounded-xl bg-gold-300 px-4 text-sm font-semibold text-ink transition hover:bg-gold-400 disabled:opacity-40">Find</button>
      </form>

      {showIdeas && (
        <div className="space-y-3 border-t border-white/10 px-4 py-3">
          <p className="text-xs text-indigo-200">
            {docs ? `Search ${docs.toLocaleString()} ARIA files by describing them in your own words, or explore the map.` : "Describe a file in your own words, or explore the map."}
          </p>
          {recent.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">Recent</p>
              <div className="flex flex-wrap gap-1.5">{recent.map((x) => <button key={x} type="button" className={chip} onClick={() => run(x)}>{x}</button>)}</div>
            </div>
          )}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">Try</p>
            <div className="flex flex-wrap gap-1.5">{EXAMPLES.map((x) => <button key={x} type="button" className={chip} onClick={() => run(x)}>{x}</button>)}</div>
          </div>
        </div>
      )}

      {loading && <Stage />}
      {error && <p role="alert" className="border-t border-white/10 px-4 py-3 text-sm text-red-200">{error}</p>}

      {hits && !loading && !showIdeas && (
        <div className="border-t border-white/10">
          <div className="flex items-center justify-between gap-3 px-4 py-2">
            <p className="min-w-0 truncate text-xs text-indigo-200">
              {hits.length ? <><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-gold-300 align-middle" />Best {hits.length} for &ldquo;{asked}&rdquo;</> : <>Nothing matched &ldquo;{asked}&rdquo;</>}
            </p>
            {hits.length > 0 && (
              <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold text-indigo-200 hover:bg-white/10 hover:text-white">{open ? "Hide" : "Show"}</button>
            )}
          </div>
          {hits.length === 0 && (
            <p className="px-4 pb-3 text-sm text-indigo-100">Try describing the situation instead of a file name, or use fewer, simpler words.</p>
          )}
          {open && hits.length > 0 && (
            <ol className="max-h-[38vh] space-y-0.5 overflow-auto px-2 pb-2">
              {hits.map((h, i) => (
                <li key={h.driveId} className="group relative">
                  <button
                    type="button"
                    onClick={() => pick(h)}
                    aria-current={picked === h.driveId || undefined}
                    className={`flex w-full gap-3 rounded-xl px-2.5 py-2 pr-16 text-left transition hover:bg-white/10 ${picked === h.driveId ? "bg-white/10" : ""}`}
                  >
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold-300 text-[11px] font-bold text-ink">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block break-words text-sm font-semibold leading-snug text-white">{h.name}</span>
                      {(h.reason || h.snippet) && <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-indigo-200">{h.reason || h.snippet}</span>}
                    </span>
                  </button>
                  <a href={h.url} target="_blank" rel="noreferrer" className="absolute right-2 top-2 rounded-lg border border-white/15 px-2 py-1 text-xs font-semibold text-indigo-100 opacity-80 transition hover:bg-white/10 hover:opacity-100 group-hover:opacity-100">Open</a>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="sm:h-full">
      <h1 className="sr-only">ARIA search</h1>
      <AriaMap picks={hits?.map((h) => h.driveId) ?? []} related={related} focusKey={focusKey} focusDoc={focusDoc} overlay={panel} />
    </div>
  );
}
