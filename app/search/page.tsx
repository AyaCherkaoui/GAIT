"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Card, ErrorBox, PageHeader, Working, btn2Cls, btnCls, inputCls, labelCls, submitOnCmdEnter } from "@/components/ui";
import { get, post } from "@/lib/client";
import type { Hit } from "@/lib/types";

const EXAMPLES = [
  "A handout on integrating quotes for ESL students",
  "How do I help a student who only wants proofreading?",
  "Templates for a thesis statement",
  "Citation help for MLA and APA",
];
const STAGES = ["searching keywords", "matching files", "picking the best 5"];
const RECENT_KEY = "ink-recent-searches";
const VIEW_KEY = "ink-search-view";
const AriaMap = dynamic(() => import("@/components/AriaMap"), { ssr: false });

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}

function Progress() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const a = setTimeout(() => setStage(1), 2500);
    const b = setTimeout(() => setStage(2), 6000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  return (
    <div className="space-y-2">
      <Working label={`Searching ARIA: ${STAGES[stage]}`} />
      <p className="text-sm text-stone-600" aria-hidden>
        {STAGES.map((s, i) => <span key={s} className={i === stage ? "font-semibold text-ink" : ""}>{i > 0 && " → "}{s}</span>)}
      </p>
    </div>
  );
}

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [docs, setDocs] = useState<number | null>(null);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [terms, setTerms] = useState<string[]>([]);
  const [asked, setAsked] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [related, setRelated] = useState<string[]>([]);
  const [view, setView] = useState<"list" | "map">("list");
  const [focusKey, setFocusKey] = useState(0);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    box.current?.focus();
    setRecent(readRecent());
    try { if (localStorage.getItem(VIEW_KEY) === "map") setView("map"); } catch { /* storage blocked */ }
    get<{ docs: number }>("/api/search").then((j) => setDocs(j.docs)).catch(() => {});
  }, []);

  async function run(question: string) {
    const text = question.trim();
    if (!text || loading) return;
    setQ(text);
    setLoading(true);
    setError(null);
    setHits(null);
    try {
      const r = await post<{ hits: Hit[]; terms: string[]; indexEmpty: boolean; related?: string[] }>("/api/search", { q: text });
      setRelated(r.related || []);
      setFocusKey((k) => k + 1);
      if (r.indexEmpty) setError("The ARIA index is empty. Run npm run sync-aria first (see AGENTS.md).");
      setHits(r.hits);
      setTerms(r.terms);
      setAsked(text);
      const next = [text, ...readRecent().filter((x) => x !== text)].slice(0, 5);
      setRecent(next);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const pickView = (v: "list" | "map") => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* storage blocked */ } };
  const tab = (on: boolean) => `min-h-10 rounded-md px-4 text-sm font-semibold transition ${on ? "bg-ink text-white shadow-sm" : "text-stone-700 hover:bg-stone-100"}`;
  const chip = "min-h-10 rounded-full border border-stone-300 bg-white px-3.5 py-1.5 text-left text-sm text-stone-800 transition hover:border-ink hover:bg-gold-50 disabled:opacity-50";
  return (
    <div className="space-y-6">
      <PageHeader title="ARIA search">
        {docs === null ? "…" : docs === 0 ? "No ARIA files indexed yet: run npm run sync-aria." : `${docs} ARIA files indexed. Describe what you are looking for in your own words.`}
      </PageHeader>
      <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="space-y-3">
        <label htmlFor="aria-q" className={labelCls}>What are you looking for?</label>
        <textarea
          id="aria-q"
          ref={box}
          rows={2}
          className={`${inputCls} text-lg sm:text-xl`}
          placeholder="For example, a handout on integrating quotes for ESL students"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(q); } else submitOnCmdEnter(e);
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button className={`${btnCls} min-h-11`} disabled={loading || !q.trim()}>Find files</button>
          <span className="text-sm text-stone-600">Press Enter to search.</span>
        </div>
      </form>

      <div role="tablist" aria-label="Show results as" className="inline-flex rounded-lg border border-stone-200 bg-white p-1">
        <button type="button" role="tab" aria-selected={view === "list"} className={tab(view === "list")} onClick={() => pickView("list")}>List</button>
        <button type="button" role="tab" aria-selected={view === "map"} className={tab(view === "map")} onClick={() => pickView("map")}>Map</button>
      </div>

      {view === "map" && (
        <section aria-label="ARIA Map" className="space-y-2">
          {hits && hits.length > 0 && <p className="text-sm text-stone-700"><span className="inline-block h-2.5 w-2.5 rounded-full bg-gold-300 align-middle ring-2 ring-gold-300/40" /> Gold files match &ldquo;{asked}&rdquo;; {hits.length === 1 ? "the brightest is the best match." : `the brightest are the best ${hits.length}.`}</p>}
          <AriaMap picks={hits?.map((h) => h.driveId) ?? []} related={related} focusKey={focusKey} />
        </section>
      )}

      {!hits && !loading && view === "list" && (
        <section aria-label="Example questions" className="space-y-2">
          <p className="text-sm font-semibold text-stone-800">Try one of these</p>
          <div className="flex flex-wrap gap-2">{EXAMPLES.map((x) => <button key={x} type="button" className={chip} onClick={() => run(x)}>{x}</button>)}</div>
        </section>
      )}

      {loading && <Progress />}
      <ErrorBox error={error} />

      {hits && hits.length > 0 && view === "list" && (
        <section aria-label="Results" className="space-y-3">
          {terms.length > 0 && <p className="text-sm text-stone-600">Searched for: <span className="mark">{terms.join(", ")}</span></p>}
          <ul className="space-y-3">
            {hits.map((h) => (
              <li key={h.driveId}>
                <Card>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="break-words font-display text-xl font-semibold text-ink">{h.name}</h2>
                      {h.reason && <p className="mt-1 max-w-prose text-[15px] text-stone-800"><span className="font-semibold">Why it matched:</span> {h.reason}</p>}
                      {h.snippet && <p className="mt-1 max-w-prose text-sm text-stone-600">{h.snippet}</p>}
                    </div>
                    <a href={h.url} target="_blank" rel="noreferrer" className={`${btn2Cls} min-h-11 shrink-0`}>Open in Drive</a>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          <p className="text-sm text-stone-600">Not quite right? Reword your question above and search again.</p>
        </section>
      )}

      {hits && hits.length === 0 && !error && view === "list" && (
        <Card title="Nothing matched">
          <p className="max-w-prose text-[15px] text-stone-700">No ARIA files matched &ldquo;{asked}&rdquo;. Try rewording:</p>
          <ul className="mt-2 max-w-prose list-disc space-y-1 pl-6 text-[15px] text-stone-700">
            <li>Describe the situation instead of a file name.</li>
            <li>Use fewer, simpler words, or a related topic.</li>
            <li>Name the student need, such as thesis, citations or organization.</li>
          </ul>
        </Card>
      )}

      {recent.length > 0 && !loading && (
        <section aria-label="Recent searches" className="space-y-2">
          <p className="text-sm font-semibold text-stone-800">Recent searches</p>
          <div className="flex flex-wrap gap-2">{recent.map((x) => <button key={x} type="button" className={chip} onClick={() => run(x)}>{x}</button>)}</div>
        </section>
      )}
    </div>
  );
}
