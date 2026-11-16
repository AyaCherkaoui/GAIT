/**
 * Meaning match for ARIA: file embeddings made by a local Ollama model (nothing leaves the computer).
 * Vectors live in gait.db (table aria_vecs), built by `npm run build-aria-map`.
 */
import { getDb } from "./db";

export const EMBED_MODEL = process.env.GAIT_EMBED_MODEL || "nomic-embed-text";
const OLLAMA = (process.env.OLLAMA_HOST || "http://localhost:11434").replace(/\/$/, "");

export function ensureVecTables() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS aria_vecs (drive_id TEXT PRIMARY KEY, vec BLOB NOT NULL);
    CREATE TABLE IF NOT EXISTS aria_map (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL, built_at TEXT NOT NULL);
  `);
}

/** Embeds texts with the local model; returns unit-length vectors. */
export async function embed(texts: string[], kind: "document" | "query"): Promise<Float32Array[]> {
  const prefix = kind === "query" ? "search_query: " : "search_document: ";
  const res = await fetch(`${OLLAMA}/api/embed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts.map((t) => prefix + t), truncate: true }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`embed failed: ${res.status} ${await res.text().catch(() => "")}`);
  const j = (await res.json()) as { embeddings: number[][] };
  return j.embeddings.map(normalize);
}

export function normalize(v: ArrayLike<number>): Float32Array {
  const out = Float32Array.from(v);
  let s = 0;
  for (let i = 0; i < out.length; i++) s += out[i] * out[i];
  const n = Math.sqrt(s) || 1;
  for (let i = 0; i < out.length; i++) out[i] /= n;
  return out;
}

export function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

let cache: { ids: string[]; vecs: Float32Array[] } | null = null;

/** All stored vectors, cached in memory after the first read. */
export function loadVectors(): { ids: string[]; vecs: Float32Array[] } {
  if (cache) return cache;
  ensureVecTables();
  const rows = getDb().prepare("SELECT drive_id, vec FROM aria_vecs").all() as { drive_id: string; vec: Uint8Array }[];
  const ids: string[] = [];
  const vecs: Float32Array[] = [];
  for (const r of rows) {
    ids.push(r.drive_id);
    vecs.push(new Float32Array(r.vec.buffer.slice(r.vec.byteOffset, r.vec.byteOffset + r.vec.byteLength)));
  }
  cache = { ids, vecs };
  return cache;
}

export function clearVectorCache() {
  cache = null;
}

/** The files closest in meaning to a question. Empty when no vectors exist or the model is not running. */
export async function semanticSearch(question: string, limit = 25): Promise<{ driveId: string; score: number }[]> {
  const { ids, vecs } = loadVectors();
  if (!ids.length) return [];
  const [q] = await embed([question], "query").catch(() => [null]);
  if (!q) return [];
  const scored = vecs.map((v, i) => ({ driveId: ids[i], score: dot(q, v) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
