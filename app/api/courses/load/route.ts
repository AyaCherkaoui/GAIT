import { handle, readJson, requireDirector, str } from "@/lib/api";
import { NotFoundError } from "@/lib/claude";
import { MAX_SYLLABUS } from "@/lib/courses";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Director only: the indexed text of one ARIA file (found with ARIA search), to use as the syllabus. */
export async function POST(req: Request) {
  return handle(req, async (user) => {
    requireDirector(user);
    const driveId = str((await readJson(req)).driveId, 200);
    const row = getDb().prepare("SELECT name, text FROM aria_docs WHERE drive_id = ?").get(driveId) as { name: string; text: string } | undefined;
    if (!row) throw new NotFoundError("That file is not in the ARIA index.");
    return { name: row.name, syllabus: row.text.slice(0, MAX_SYLLABUS) };
  });
}
