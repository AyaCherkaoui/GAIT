"use client";
import { useEffect, useState } from "react";
import { Card, ErrorBox, btnCls, inputCls } from "@/components/ui";
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
      <div>
        <h1 className="text-2xl font-bold">ARIA search</h1>
        <p className="text-sm text-slate-600">
          {docs === null ? "…" : docs === 0 ? "No ARIA files indexed yet: run npm run sync-aria." : `${docs} ARIA files indexed.`}
        </p>
      </div>
      <form onSubmit={search} className="flex gap-2">
        <input className={inputCls} placeholder="e.g. handouts on integrating quotes for ESL students" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={btnCls} disabled={loading}>{loading ? "Searching…" : "Search"}</button>
      </form>
      <ErrorBox error={error} />
      {terms.length > 0 && <p className="text-xs text-slate-500">Searched for: {terms.join(", ")}</p>}
      {hits && hits.length === 0 && !error && <p className="text-sm">Nothing matched. Try other words.</p>}
      <div className="space-y-3">
        {hits?.map((h) => (
          <Card key={h.driveId}>
            <a href={h.url} target="_blank" rel="noreferrer" className="font-medium text-indigo-700 hover:underline">{h.name}</a>
            {h.reason && <p className="text-sm">{h.reason}</p>}
            <p className="mt-1 text-xs text-slate-500">{h.snippet}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
