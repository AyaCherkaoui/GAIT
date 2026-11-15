"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { btn2Cls, btnCls, Chip, Empty, ErrorBox, inputCls, PageHeader } from "@/components/ui";
import { get, post } from "@/lib/client";
import { TOPICS, type NewsItem, type NewsResult } from "@/lib/news-types";

const linkCls = "text-ink underline decoration-gold-400 decoration-2 underline-offset-4 hover:bg-gold-100";

function ago(ms: number, now: number): string {
  const m = Math.max(0, Math.round((now - ms) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return d < 14 ? `${d} day${d === 1 ? "" : "s"} ago` : new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Skeleton() {
  return (
    <ul aria-label="Loading articles" className="grid gap-4 md:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="animate-pulse space-y-3 rounded-lg border border-stone-200 bg-white p-5">
          <div className="h-3 w-1/3 rounded bg-stone-200" />
          <div className="h-5 w-4/5 rounded bg-stone-200" />
          <div className="h-3 w-full rounded bg-stone-100" />
          <div className="h-3 w-2/3 rounded bg-stone-100" />
        </li>
      ))}
    </ul>
  );
}

function Card({ item, now }: { item: NewsItem; now: number }) {
  const [move, setMove] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function tryIt() {
    setBusy(true);
    setErr(null);
    try {
      setMove((await post<{ move: string }>("/api/news/try", { title: item.title, summary: item.summary })).move);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <li className="flex flex-col rounded-lg border border-stone-200 bg-white p-5">
      <p className="text-sm text-stone-600">
        {item.source} · <time dateTime={item.date}>{ago(new Date(item.date).getTime(), now)}</time>
      </p>
      <h2 className="mt-1 font-display text-lg font-semibold leading-snug text-ink">
        <a className={`${linkCls} inline-block py-1`} href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
      </h2>
      {item.summary && <p className="mt-1 line-clamp-2 text-[15px] text-stone-800">{item.summary}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Chip tone="gold">{item.topic}</Chip>
        {item.author && <span className="text-xs text-stone-600">{item.author}</span>}
      </div>
      <div className="mt-3">
        <button type="button" className={btn2Cls} onClick={tryIt} disabled={busy} aria-expanded={move !== null}>
          {busy ? "Thinking…" : move ? "Try another take" : "Try this with a student"}
        </button>
      </div>
      {err && <div className="mt-3"><ErrorBox error={err} /></div>}
      {move && (
        <div className="mt-3 rounded-md border border-gold-300/70 bg-gold-50 p-3 text-[15px] text-stone-900" role="status">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gold-600">One move to try</p>
          <p>{move}</p>
        </div>
      )}
    </li>
  );
}

export default function NewsPage() {
  const [data, setData] = useState<NewsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState<string>("All");
  const [q, setQ] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback((refresh: boolean) => {
    setLoading(true);
    setError(null);
    get<NewsResult>(`/api/news${refresh ? "?refresh=1" : ""}`)
      .then((j) => { setData(j); setNow(Date.now()); })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the news."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    load(false);
  }, [load]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.items ?? []).filter(
      (i) => (topic === "All" || i.topic === topic) && (!needle || `${i.title} ${i.summary} ${i.source} ${i.author ?? ""}`.toLowerCase().includes(needle)),
    );
  }, [data, topic, q]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="News"
        actions={
          <div className="flex items-center gap-3">
            {data && <span className="text-sm text-stone-600" aria-live="polite">Updated {ago(data.updatedAt, now)}</span>}
            <button type="button" className={btnCls} onClick={() => load(true)} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
          </div>
        }
      >
        Recent articles on tutoring, writing-center practice, helping students improve, and AI as a coach.
      </PageHeader>

      <div className="space-y-3">
        <label className="block">
          <span className="sr-only">Search articles</span>
          <input type="search" className={inputCls} placeholder="Search articles" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div role="group" aria-label="Topic" className="flex flex-wrap gap-2">
          {["All", ...TOPICS].map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={topic === t}
              onClick={() => setTopic(t)}
              className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold transition ${topic === t ? "border-ink bg-ink text-white" : "border-stone-300 bg-white text-stone-800 hover:bg-stone-100"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {!!data?.failed.length && (
        <p role="status" className="rounded-md border-l-4 border-gold-400 bg-gold-50 px-4 py-3 text-sm text-stone-800">
          Could not load: {data.failed.join(", ")}. The other sources are shown.
        </p>
      )}
      <ErrorBox error={error} />
      {loading && !data && <Skeleton />}
      {data && shown.length === 0 && (
        <Empty title={data.items.length ? "No articles match" : "No articles right now"}>
          {data.items.length ? "Try another topic or clear the search." : "The article sources could not be reached. Check your internet connection and press Refresh."}
        </Empty>
      )}
      {shown.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2">
          {shown.map((i) => <Card key={i.url} item={i} now={now} />)}
        </ul>
      )}
    </div>
  );
}
