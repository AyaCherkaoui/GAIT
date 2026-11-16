import { handle, readJson, requireDirector, str } from "@/lib/api";
import { NotFoundError } from "@/lib/claude";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = { user_id: number | null; director_note: string | null; director_note_at: string | null };

function load(id: number): Row {
  if (!Number.isInteger(id)) throw new NotFoundError("Session not found.");
  const row = getDb().prepare("SELECT user_id, director_note, director_note_at FROM sessions WHERE id = ?").get(id) as Row | undefined;
  if (!row) throw new NotFoundError("Session not found.");
  return row;
}

/** The note the director left on a session: the tutor who owns the session and the director can read it. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(req, async (user) => {
    const row = load(Number((await params).id));
    if (user.role !== "director" && row.user_id !== user.id) throw new NotFoundError("Session not found.");
    return { note: row.director_note ?? "", updatedAt: row.director_note_at, canEdit: user.role === "director" };
  });
}

/** Director only. An empty note clears it. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(req, async (user) => {
    requireDirector(user);
    const id = Number((await params).id);
    load(id);
    const note = str((await readJson(req)).note, 2000).trim();
    getDb()
      .prepare("UPDATE sessions SET director_note = ?, director_note_at = CASE WHEN ? = '' THEN NULL ELSE datetime('now') END WHERE id = ?")
      .run(note || null, note, id);
    return { note, updatedAt: load(id).director_note_at };
  });
}
