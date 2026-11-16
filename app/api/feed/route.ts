import { handle } from "@/lib/api";
import { BOOKS } from "@/lib/books";
import { text } from "@/lib/news";
import type { FeedItem } from "@/lib/types";

export const dynamic = "force-dynamic";

const SOURCES = [
  { name: "Another Word (UW-Madison Writing Center)", url: "https://writing.wisc.edu/blog/feed" },
  { name: "Inside Higher Ed", url: "https://www.insidehighered.com/rss.xml" },
];

// Per source: a good answer is kept 1 h, a failed one is remembered 5 min (so a slow source does not stall every visit),
// and a request already in flight is shared.
const cache = new Map<string, { at: number; ok: boolean; items: FeedItem[]; pending?: Promise<FeedItem[]> }>();

async function readFeed(name: string, url: string): Promise<FeedItem[]> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { "user-agent": "Mozilla/5.0 Ink" } });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.split(/<item[\s>]/).slice(1, 6);
    return items
      .map((b) => ({ title: text(b, "title"), url: text(b, "link"), source: name, date: text(b, "pubDate") || undefined }))
      .filter((i) => i.title && /^https?:\/\//.test(i.url));
  } catch {
    return []; // timeout or network error: that source is skipped
  }
}

async function cached(name: string, url: string): Promise<FeedItem[]> {
  const hit = cache.get(url);
  if (hit?.pending) return hit.pending;
  if (hit && Date.now() - hit.at < (hit.ok ? 3600_000 : 300_000)) return hit.items;
  const pending = readFeed(name, url).then((items) => {
    cache.set(url, { at: Date.now(), ok: items.length > 0, items: items.length ? items : hit?.items ?? [] });
    return cache.get(url)!.items;
  });
  cache.set(url, { at: hit?.at ?? 0, ok: hit?.ok ?? false, items: hit?.items ?? [], pending });
  return pending;
}

export async function GET(req: Request) {
  return handle(req, async () => {
    const lists = await Promise.all(SOURCES.map((s) => cached(s.name, s.url)));
    return { items: lists.flat(), books: BOOKS };
  });
}
