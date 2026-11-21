import { getDb } from "./db";
import { askJson, hasModel } from "./claude";
import { TASK_FORCES } from "./task-forces";

export type TagSource = "folder" | "ai" | "director";

/** Words in a Drive folder name that put its files in a task force. The folder name wins over the AI. */
const FOLDER_WORDS: Record<string, string[]> = {
  "aria-curators": ["curator", "aria archive"],
  "gait-keepers": ["gait", "genai", "gen ai", "ai tools", "ai policy", "ai policies", "ai session"],
  "good-troublemakers": ["good trouble", "troublemaker", "oscc", "heritage month", "read-in", "read in", "culture"],
  "merch-publicity": ["merch", "publicity", "poster", "flyer"],
  "party-planners": ["party", "birthday", "50th", "bash"],
  "social-media": ["social media", "instagram", "facebook"],
  "rwc-scholars": ["scholar", "journal"],
};

/** The task force a folder name points to, or null. */
export function tagFromFolder(folder: string): string | null {
  const f = folder.toLowerCase();
  if (!f.trim()) return null;
  for (const tf of TASK_FORCES) if (FOLDER_WORDS[tf.key]?.some((w) => f.includes(w))) return tf.key;
  return null;
}

/** One fast-model call: the answer is a task force key or none. Anything else is dropped. */
export async function tagFromAi(name: string, text: string): Promise<string | null> {
  if (!hasModel()) return null;
  const list = TASK_FORCES.map((t) => `${t.key}: ${t.name}. ${t.description}`).join("\n");
  const r = await askJson<{ taskForce?: unknown }>({
    model: "fast",
    system: `You file documents from a writing center's shared folder under the task force they belong to, or under none. Task forces:\n${list}\nReturn {"taskForce": "<key>"} or {"taskForce": null} when none clearly fits.`,
    messages: [{ role: "user", content: `File name: ${name}\n\n${text.slice(0, 1500)}` }],
  }).catch(() => null);
  const k = r?.taskForce;
  return typeof k === "string" && TASK_FORCES.some((t) => t.key === k) ? k : null;
}

/** Folder-name match first, else the model. */
export async function tagDoc(name: string, text: string, folder: string): Promise<{ key: string | null; source: TagSource }> {
  const byFolder = tagFromFolder(folder);
  if (byFolder) return { key: byFolder, source: "folder" };
  return { key: await tagFromAi(name, text), source: "ai" };
}

export function saveTag(driveId: string, key: string | null, source: TagSource) {
  getDb()
    .prepare(
      "INSERT INTO aria_doc_tags (drive_id, task_force_key, source) VALUES (?, ?, ?) ON CONFLICT(drive_id) DO UPDATE SET task_force_key = excluded.task_force_key, source = excluded.source",
    )
    .run(driveId, key, source);
}

export function tagSource(driveId: string): TagSource | null {
  const r = getDb().prepare("SELECT source FROM aria_doc_tags WHERE drive_id = ?").get(driveId) as { source: TagSource } | undefined;
  return r?.source ?? null;
}

/** Tag a file unless it already has a tag (the director's tag is never replaced). */
export async function tagIfNeeded(driveId: string, name: string, text: string, folder: string, force = false) {
  const src = tagSource(driveId);
  if (src === "director" || (src && !force)) return;
  const t = await tagDoc(name, text, folder);
  saveTag(driveId, t.key, t.source);
}

/** Tags for many files at once: drive id to task force key. */
export function tagsFor(ids: string[]): Map<string, string | null> {
  const get = getDb().prepare("SELECT task_force_key FROM aria_doc_tags WHERE drive_id = ?");
  const out = new Map<string, string | null>();
  for (const id of ids) {
    const r = get.get(id) as { task_force_key: string | null } | undefined;
    if (r) out.set(id, r.task_force_key);
  }
  return out;
}

export function allTags(): Map<string, string | null> {
  const rows = getDb().prepare("SELECT drive_id, task_force_key FROM aria_doc_tags").all() as { drive_id: string; task_force_key: string | null }[];
  return new Map(rows.map((r) => [r.drive_id, r.task_force_key]));
}

export function removeTagsOfMissingDocs() {
  getDb().prepare("DELETE FROM aria_doc_tags WHERE drive_id NOT IN (SELECT drive_id FROM aria_docs)").run();
}
