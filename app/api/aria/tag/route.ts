import { handle, HttpError, readJson, requireDirector, str } from "@/lib/api";
import { NotFoundError } from "@/lib/claude";
import { getDb } from "@/lib/db";
import { saveTag } from "@/lib/aria-tags";
import { taskForce } from "@/lib/task-forces";

export const dynamic = "force-dynamic";

/** Director only: set or clear the task force of one ARIA file. `key: null` means no task force. */
export async function POST(req: Request) {
  return handle(req, async (user) => {
    requireDirector(user);
    const body = await readJson(req);
    const driveId = str(body.driveId, 200).trim();
    if (!driveId) throw new HttpError(400, "Say which file.");
    if (body.key !== null && !taskForce(body.key)) throw new HttpError(400, "Choose a task force from the list.");
    if (!getDb().prepare("SELECT 1 FROM aria_docs WHERE drive_id = ?").get(driveId)) throw new NotFoundError("That file is not in the ARIA index.");
    saveTag(driveId, body.key as string | null, "director");
    return { driveId, key: body.key as string | null };
  });
}
