"use client";
import { useEffect, useState } from "react";
import { Empty, ErrorBox, PageHeader, Working, btnCls, inputCls, labelCls } from "@/components/ui";
import { get, post } from "@/lib/client";
import type { Hit } from "@/lib/types";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [docs, setDocs] = useState<number | null>(null);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [terms, setTerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { get<{ docs: number }>("/api/search").then((j) => setDocs(j.docs)).catch(() => {}); }, []);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await post<{ hits: Hit[]; terms: string[]; indexEmpty: boolean }>("/api/search", { q });
      if (r.indexEmpty) setError("The ARIA index is empty. Run npm run sync-aria first (see AGENTS.md).");
      setHits(r.hits);
      setTerms(r.terms);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="ARIA search">
        {docs === null ? "…" : docs === 0 ? "No ARIA files indexed yet: run npm run sync-aria." : `${docs} ARIA files indexed. Describe what you are looking for in your own words.`}
      </PageHeader>
      <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="aria-q" className={labelCls}>What are you looking for?</label>
          <input id="aria-q" className={`${inputCls} min-h-11`} placeholder="For example, a handout on integrating quotes for ESL students" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className={`${btnCls} min-h-11`} disabled={loading}>Find files</button>
      </form>
      {loading && <Working label="Searching ARIA" />}
      <ErrorBox error={error} />
      {terms.length > 0 && <p className="text-sm text-stone-600">Searched for: <span className="mark">{terms.join(", ")}</span></p>}
      {hits && hits.length === 0 && !error && <Empty title="Nothing matched">Try different words, or describe the situation instead of the file name.</Empty>}
      {hits && hits.length > 0 && (
        <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
          {hits.map((h) => (
            <li key={h.driveId} className="px-5 py-4 sm:px-6">
              <a href={h.url} target="_blank" rel="noreferrer" className="inline-block break-words py-1.5 font-display text-lg font-semibold text-ink underline decoration-gold-400 decoration-2 underline-offset-4 hover:text-indigo-700">{h.name}</a>
              {h.snippet && <p className="mt-1 max-w-prose text-[15px] text-stone-800">{h.snippet}</p>}
              {h.reason && <p className="mt-1 max-w-prose text-sm italic text-stone-600">Why it matches: {h.reason}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
