import { getDb } from "./db";
import { askJson } from "./claude";
import type { Hit } from "./types";

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
export function keywordSearch(terms: string[], limit = 20): Hit[] {
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
export async function smartSearch(question: string): Promise<{ hits: Hit[]; terms: string[]; indexEmpty: boolean }> {
  if (docCount() === 0) return { hits: [], terms: [], indexEmpty: true };
  const { terms } = await askJson<{ terms: string[] }>({
    model: "fast",
    system:
      'A writing-center tutor is searching the center\'s shared folder of handouts, training material, templates and reports. Turn their question into 6-12 short keywords or phrases (include synonyms and related terms). Return {"terms": [...]}.',
    messages: [{ role: "user", content: question }],
  });
  const candidates = keywordSearch([question, ...(terms ?? [])]);
  if (!candidates.length) return { hits: [], terms, indexEmpty: false };
  const { picks } = await askJson<{ picks: { i: number; reason: string }[] }>({
    model: "fast",
    system:
      'Pick up to 5 documents that best answer the tutor\'s question, best first. Skip ones that do not fit. Return {"picks": [{"i": <index>, "reason": "<one short line on why it fits>"}]}.',
    messages: [
      {
        role: "user",
        content: `Question: ${question}\n\n${candidates.map((c, i) => `[${i}] ${c.name}: ${c.snippet}`).join("\n")}`,
      },
    ],
  });
  const hits = (picks ?? []).filter((p) => candidates[p.i]).map((p) => ({ ...candidates[p.i], reason: p.reason }));
  return { hits, terms, indexEmpty: false };
}
