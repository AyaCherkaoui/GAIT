import { getDb } from "./db";
import { askJson } from "./claude";
import type { Hit } from "./types";
import { semanticSearch } from "./aria-embed";

export function docCount(): number {
  const row = getDb().prepare("SELECT count(*) AS n FROM aria_docs").get() as { n: number };
  return row.n;
}

const STOP = new Set("a an and are for from how i in is it me of on or that the to what with about any do we you".split(" "));

function ftsQuery(terms: string[]): string {
  const parts = new Set<string>();
  for (const t of terms) {
    const clean = t.replace(/["*^():]/g, " ").trim().toLowerCase();
    if (!clean) continue;
    parts.add(`"${clean}"`);
    for (const w of clean.split(/\s+/)) if (w.length > 2 && !STOP.has(w)) parts.add(`"${w}"`);
  }
  return [...parts].join(" OR ");
}

/** Plain keyword search over the ARIA index. */
export function keywordSearch(terms: string[], limit = 25): Hit[] {
  const q = ftsQuery(terms);
  if (!q) return [];
  const rows = getDb()
    .prepare(
      `SELECT drive_id, name, url, snippet(aria_docs, 5, '', '', '…', 30) AS snippet
       FROM aria_docs WHERE aria_docs MATCH ? ORDER BY rank LIMIT ?`,
    )
    .all(q, limit) as { drive_id: string; name: string; url: string; snippet: string }[];
  return rows.map((r) => ({ driveId: r.drive_id, name: r.name, url: r.url, snippet: r.snippet }));
}

/** Claude expands the question, the index finds candidates, Claude picks the best few. */
/** Files by id, with a short opening passage, for meaning matches that keyword search did not find. */
function docsById(ids: string[]): Map<string, Hit> {
  const get = getDb().prepare("SELECT drive_id, name, url, substr(text, 1, 400) AS t FROM aria_docs WHERE drive_id = ?");
  const out = new Map<string, Hit>();
  for (const id of ids) {
    const r = get.get(id) as { drive_id: string; name: string; url: string; t: string } | undefined;
    if (r) out.set(id, { driveId: r.drive_id, name: r.name, url: r.url, snippet: (r.t || "").replace(/\s+/g, " ").trim().slice(0, 220) });
  }
  return out;
}

/** Hybrid search: word match plus meaning match (local embeddings), merged by reciprocal rank, then reranked. */
export async function smartSearch(question: string): Promise<{ hits: Hit[]; terms: string[]; indexEmpty: boolean; related: string[] }> {
  if (docCount() === 0) return { hits: [], terms: [], indexEmpty: true, related: [] };
  const semantic = semanticSearch(question, 25).catch(() => []);
  const expanded = await askJson<{ terms?: unknown }>({
    model: "fast",
    system:
      'A writing-center tutor is searching the center\'s shared folder of handouts, training material, templates and reports. Turn their question into 6-12 short keywords or phrases (include synonyms and related terms). Return {"terms": [...]}.',
    messages: [{ role: "user", content: question }],
  }).catch(() => ({ terms: [] }));
  // The model's JSON is not trusted: keep only string terms.
  const terms = Array.isArray(expanded?.terms) ? expanded.terms.filter((t): t is string => typeof t === "string").slice(0, 12) : [];
  const words = keywordSearch([question, ...terms]);
  const meaning = await semantic;
  const score = new Map<string, number>();
  words.forEach((h, i) => score.set(h.driveId, (score.get(h.driveId) || 0) + 1 / (60 + i)));
  meaning.forEach((m, i) => score.set(m.driveId, (score.get(m.driveId) || 0) + 1 / (60 + i)));
  const byId = new Map(words.map((h) => [h.driveId, h]));
  const extra = docsById(meaning.map((m) => m.driveId).filter((id) => !byId.has(id)));
  const candidates = [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => byId.get(id) || extra.get(id))
    .filter((h): h is Hit => !!h)
    .slice(0, 25);
  if (!candidates.length) return { hits: [], terms, indexEmpty: false, related: [] };
  const related = candidates.map((c) => c.driveId);
  const fallback = () => candidates.slice(0, 5);
  const picked = await askJson<{ picks?: unknown }>({
    model: "fast",
    system:
      'Pick up to 5 documents that best answer the tutor\'s question, best first. Skip ones that do not fit. Return {"picks": [{"i": <index>, "reason": "<one short line on why it fits>"}]}.',
    messages: [
      {
        role: "user",
        content: `Question: ${question}\n\n${candidates.map((c, i) => `[${i}] ${c.name}: ${c.snippet}`).join("\n")}`,
      },
    ],
  }).catch(() => null);
  const picks = Array.isArray(picked?.picks) ? (picked.picks as { i?: unknown; reason?: unknown }[]) : [];
  const hits: Hit[] = [];
  const seen = new Set<number>();
  for (const p of picks) {
    const i = p?.i;
    if (typeof i !== "number" || !candidates[i] || seen.has(i)) continue;
    seen.add(i);
    hits.push({ ...candidates[i], reason: typeof p.reason === "string" ? p.reason : undefined });
  }
  return { hits: hits.length ? hits.slice(0, 5) : fallback(), terms, indexEmpty: false, related };
}
