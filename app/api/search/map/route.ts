import { handle } from "@/lib/api";
import { NotFoundError } from "@/lib/claude";
import { getDb } from "@/lib/db";
import { ensureVecTables } from "@/lib/aria-embed";
import { allTags } from "@/lib/aria-tags";
import type { AriaMap, AriaPreview } from "@/lib/aria-map-types";

export const dynamic = "force-dynamic";

let cached: { builtAt: string; map: AriaMap } | null = null;

function readMap(): AriaMap | null {
  ensureVecTables();
  const row = getDb().prepare("SELECT json, built_at FROM aria_map WHERE id = 1").get() as { json: string; built_at: string } | undefined;
  if (!row) return null;
  if (cached?.builtAt !== row.built_at) cached = { builtAt: row.built_at, map: JSON.parse(row.json) as AriaMap };
  return cached.map;
}

/** GET: the whole ARIA Map. GET ?doc=<driveId>: one file's preview. */
export async function GET(req: Request) {
  return handle(req, async () => {
    const doc = new URL(req.url).searchParams.get("doc");
    if (!doc) {
      const map = readMap();
      // Tags change without the map being rebuilt, so they are joined here, outside the cache.
      const t = allTags();
      return { map, tags: map ? map.nodes.id.map((id) => t.get(id) ?? null) : [] };
    }
    const r = getDb().prepare("SELECT drive_id, name, url, mime, text FROM aria_docs WHERE drive_id = ?").get(doc) as
      | { drive_id: string; name: string; url: string; mime: string; text: string }
      | undefined;
    if (!r) throw new NotFoundError("That file is not in the ARIA index.");
    const preview: AriaPreview = { driveId: r.drive_id, name: r.name, url: r.url, mime: r.mime, snippet: (r.text || "").replace(/\s+/g, " ").trim().slice(0, 420) };
    return preview;
  });
}
