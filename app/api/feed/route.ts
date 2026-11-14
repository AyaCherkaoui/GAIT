import { handle } from "@/lib/api";
import { BOOKS } from "@/lib/books";
import type { FeedItem } from "@/lib/types";

export const dynamic = "force-dynamic";

const SOURCES = [
  { name: "Another Word (UW-Madison Writing Center)", url: "https://writing.wisc.edu/blog/feed" },
  { name: "Inside Higher Ed", url: "https://www.insidehighered.com/rss.xml" },
];

let cache: { at: number; items: FeedItem[] } | undefined;

function text(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  if (!m) return "";
  return m[1]
    .replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .trim();
}

async function readFeed(name: string, url: string): Promise<FeedItem[]> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { "user-agent": "Mozilla/5.0 GAIT" } });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.split("<item>").slice(1, 6);
    return items
      .map((b) => ({ title: text(b, "title"), url: text(b, "link"), source: name, date: text(b, "pubDate") || undefined }))
      .filter((i) => i.title && /^https?:\/\//.test(i.url));
  } catch {
    return []; // timeout or network error: that source is skipped
  }
}

export async function GET(req: Request) {
  return handle(req, async () => {
    if (!cache || Date.now() - cache.at > 3600_000) {
      const lists = await Promise.all(SOURCES.map((s) => readFeed(s.name, s.url)));
      const items = lists.flat();
      // Only cache a real result, so a failed fetch is retried on the next visit.
      if (items.length) cache = { at: Date.now(), items };
      return { items, books: BOOKS };
    }
    return { items: cache.items, books: BOOKS };
  });
}
