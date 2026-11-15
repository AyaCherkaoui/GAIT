import fs from "node:fs";
import path from "node:path";

/** Parsing, fetching and sorting of article feeds (RSS and Atom). Used by /api/feed and /api/news. */

import { TOPICS, type NewsItem, type NewsResult, type Topic } from "./news-types";

export { TOPICS };
export type { NewsItem, NewsResult, Topic };

type Source = { name: string; url: string; /** Keep every article, not only ones that match a topic. */ all?: boolean };

/** Each URL was fetched and parsed from this machine. Dropped: Edutopia (serves a web page, not a feed), Chronicle of Higher Education and Harvard Bok Center (403), Berkeley CTL (feed is empty), Vanderbilt CFT (not a feed). */
export const NEWS_SOURCES: Source[] = [
  { name: "Another Word (UW-Madison Writing Center)", url: "https://writing.wisc.edu/blog/feed", all: true },
  { name: "Inside Higher Ed", url: "https://www.insidehighered.com/rss.xml" },
  { name: "Faculty Focus", url: "https://www.facultyfocus.com/feed/", all: true },
  { name: "Teaching in Higher Ed", url: "https://teachinginhighered.com/feed/", all: true },
  { name: "The Learning Scientists", url: "https://www.learningscientists.org/blog?format=rss", all: true },
  { name: "EdSurge", url: "https://www.edsurge.com/articles_rss" },
  { name: "The Hechinger Report", url: "https://hechingerreport.org/feed/" },
  { name: "The Conversation: Education", url: "https://theconversation.com/us/education/articles.atom" },
];

// ---- parsing ----

export function decodeEntities(s: string): string {
  return (
    s
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ")
      // Numeric entities (&#038;, &#8217;, &#x2019;), including ones that were double-encoded as &amp;#038;.
      .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n: string) => {
        const code = n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : parseInt(n, 10);
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
      })
  );
}

const unCdata = (s: string) => s.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1");

/** The decoded text inside <tag>…</tag>, or "". */
export function text(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
  return m ? decodeEntities(unCdata(m[1])).trim() : "";
}

/** The raw (still HTML-escaped) inside <tag>…</tag> with CDATA removed. */
function raw(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
  return m ? unCdata(m[1]) : "";
}

function attr(block: string, tag: string, name: string, where?: RegExp): string {
  for (const m of block.matchAll(new RegExp(`<${tag}\\s([^>]*?)/?>`, "g"))) {
    if (where && !where.test(m[1])) continue;
    const a = m[1].match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`));
    if (a) return decodeEntities(a[1]).trim();
  }
  return "";
}

/** Strips tags from (possibly escaped) HTML and returns the first two sentences, at most 300 characters. */
export function summarize(html: string, drop: string[] = []): string {
  let t = decodeEntities(html);
  t = t.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]*>/g, " ");
  t = decodeEntities(t);
  // Some feeds repeat the title, author and date (or "Byline(s)") instead of an excerpt: take those out.
  for (const d of drop) if (d) t = t.split(d).join(" ");
  t = t.replace(/\b\w{3}, \d\d\/\d\d\/\d{4} - \d\d:\d\d [AP]M/g, " ").replace(/Byline\(s\)/g, " ").replace(/\s+/g, " ").trim();
  if (t.length < 25) return "";
  const sentences = t.match(/[^.!?]+[.!?]+(?=\s|$)/g);
  let out = sentences ? sentences.slice(0, 2).join("").trim() : t;
  if (out.length > 300) out = out.slice(0, 297).replace(/\s+\S*$/, "") + "…";
  return out;
}

function firstImg(html: string): string {
  const m = decodeEntities(html).match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : "";
}

const fixUrl = (u: string) => u.replace("://s39613.pcdn.co/", "://www.facultyfocus.com/"); // Faculty Focus' feed names its CDN host
const isHttp = (u: string) => /^https?:\/\//i.test(u);

export type ParsedEntry = Omit<NewsItem, "source" | "topic">;

/** Reads the entries of an RSS 2.0 or Atom feed. Entries without a title, an http(s) link or a valid date are skipped. */
export function parseFeed(xml: string): ParsedEntry[] {
  const atom = /<feed[\s>]/.test(xml.slice(0, 2000)) && !/<rss[\s>]/.test(xml.slice(0, 2000));
  const blocks = xml.split(atom ? /<entry[\s>]/ : /<item[\s>]/).slice(1);
  const out: ParsedEntry[] = [];
  for (const b0 of blocks) {
    const b = b0.split(atom ? "</entry>" : "</item>")[0];
    const title = summarizeTitle(text(b, "title"));
    const url = fixUrl(atom ? attr(b, "link", "href", /rel=["']alternate["']|^(?!.*\brel=)/) || attr(b, "link", "href") : text(b, "link") || text(b, "guid"));
    const when = new Date(text(b, "pubDate") || text(b, "dc:date") || text(b, "published") || text(b, "updated") || text(b, "dcterms:created"));
    if (!title || !isHttp(url) || isNaN(when.getTime())) continue;
    const body = raw(b, "content:encoded") || raw(b, "description") || raw(b, "summary") || raw(b, "content");
    const author = text(b, "dc:creator") || (atom ? text(raw(b, "author"), "name") : text(b, "author")) || undefined;
    let image = attr(b, "media:content", "url", /medium=["']image["']|type=["']image|\.(jpe?g|png|webp|gif)/i) || attr(b, "media:thumbnail", "url") || attr(b, "enclosure", "url", /type=["']image/i) || firstImg(body);
    if (!isHttp(image)) image = "";
    out.push({ title, url, date: when.toISOString(), author: author && !author.includes("@") ? author : undefined, image: image || undefined, summary: summarize(body, [title, author ?? ""]) });
  }
  return out;
}

const summarizeTitle = (t: string) => decodeEntities(t.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();

// ---- topics (keyword matching, no AI) ----

const KEYWORDS: [Topic, RegExp][] = [
  ["AI and writing", /\b(ai|a\.i\.|artificial intelligence|chatgpt|gpt|generative|chatbot|llm|large language|copilot|claude|gemini)\b/i],
  ["Tutoring theory", /\b(tutor\w*|writing cent\w+|peer (?:tutor|review|learning)|pedagog\w*|scaffold\w*|non-?directive|learning theory|metacogni\w*|collaborat\w+ learning|conferenc\w+)\b/i],
  ["Student improvement", /\b(improv\w+|feedback|revis\w+|struggl\w+|motivat\w+|confiden\w+|resilien\w+|self-?regulat\w+|study (?:skills|habits)|learning (?:strateg\w+|skills)|independent|growth mindset|writer'?s? block|thesis|argument)\b/i],
  ["Teaching tips", /\b(teach\w*|classroom|assignment\w*|lesson\w*|rubric\w*|syllabus|instruct\w+|course design|student engagement|active learning|writing)\b/i],
];

/** The first topic whose keywords match the title and summary, or null. */
export function topicOf(title: string, summary: string): Topic | null {
  const t = `${title} ${summary}`;
  for (const [topic, re] of KEYWORDS) if (re.test(t)) return topic;
  return null;
}

// ---- fetching with a per-source cache ----

const TTL_MS = 3600_000; // a good answer is reused for an hour
const FAIL_MS = 300_000; // after a failure the source is left alone for five minutes
const REFRESH_MIN_MS = 60_000; // the Refresh button cannot hit a source more often than this
const MAX_AGE_MS = 60 * 86400_000;
const PER_SOURCE = 8;

type Entry = { at: number; items: ParsedEntry[] | null; failedAt?: number };
const cache = new Map<string, Entry>();

async function readSource(s: Source, force: boolean): Promise<{ items: ParsedEntry[] | null; fresh: boolean }> {
  const now = Date.now();
  const hit = cache.get(s.url);
  if (hit?.items && now - hit.at < (force ? REFRESH_MIN_MS : TTL_MS)) return { items: hit.items, fresh: false };
  if (hit?.failedAt && now - hit.failedAt < FAIL_MS) return { items: hit.items, fresh: false };
  try {
    const res = await fetch(s.url, { signal: AbortSignal.timeout(6000), headers: { "user-agent": "Mozilla/5.0 Ink", accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = parseFeed((await res.text()).slice(0, 3_000_000));
    if (!items.length) throw new Error("no articles");
    cache.set(s.url, { at: now, items });
    return { items, fresh: true };
  } catch {
    // Timeout, network error, or not a feed: remember it, and keep showing the last good answer if there is one.
    cache.set(s.url, { at: hit?.at ?? 0, items: hit?.items ?? null, failedAt: now });
    return { items: hit?.items ?? null, fresh: false };
  }
}

function fixture(): NewsResult {
  const day = (n: number) => new Date(Date.now() - n * 86400_000).toUTCString();
  const xml = fs.readFileSync(path.join(process.cwd(), "lib/fixtures/news.xml"), "utf8").replace(/__D(\d+)__/g, (_, n) => day(Number(n)));
  return { items: shape(parseFeed(xml), { name: "Fixture Writing Center Blog", url: "", all: true }, true), failed: ["Fixture Broken Source"], updatedAt: Date.now() };
}

function shape(entries: ParsedEntry[], s: Source, skipAge = false): NewsItem[] {
  const cutoff = Date.now() - MAX_AGE_MS;
  const items: NewsItem[] = [];
  for (const e of entries) {
    if (!skipAge && new Date(e.date).getTime() < cutoff) continue;
    const topic = topicOf(e.title, e.summary) ?? (s.all ? "Teaching tips" : null);
    if (topic) items.push({ ...e, source: s.name, topic });
  }
  return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, PER_SOURCE);
}

/** The latest articles from every source: de-duplicated by URL, newest first. A source that fails is listed in `failed`; the rest still show. */
export async function getNews(force = false): Promise<NewsResult> {
  if (process.env.NEWS_FIXTURE === "1") return fixture();
  const results = await Promise.all(NEWS_SOURCES.map((s) => readSource(s, force)));
  const seen = new Set<string>();
  const items: NewsItem[] = [];
  const failed: string[] = [];
  results.forEach((r, i) => {
    if (!r.items) failed.push(NEWS_SOURCES[i].name);
    else for (const it of shape(r.items, NEWS_SOURCES[i])) if (!seen.has(it.url)) (seen.add(it.url), items.push(it));
  });
  items.sort((a, b) => b.date.localeCompare(a.date));
  const times = NEWS_SOURCES.map((s) => cache.get(s.url)?.at ?? 0).filter(Boolean);
  return { items, failed, updatedAt: times.length ? Math.max(...times) : Date.now() };
}

/** The newest headlines, for the Home page. Never throws; an empty list means nothing could be loaded. */
export async function latestHeadlines(n = 3): Promise<{ title: string; url: string; source: string }[]> {
  try {
    return (await getNews()).items.slice(0, n).map(({ title, url, source }) => ({ title, url, source }));
  } catch {
    return [];
  }
}
