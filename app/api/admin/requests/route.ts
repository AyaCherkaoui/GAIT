import { handle, readJson, requireDirector } from "@/lib/api";
import { NotFoundError, UserFacingError } from "@/lib/claude";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Approve or decline one person's tutor/director request. Only the director may do this. */
export async function POST(req: Request) {
  return handle(req, async (user) => {
    requireDirector(user);
    const body = await readJson(req);
    const id = body.id;
    if (!Number.isInteger(id)) throw new UserFacingError("The request was not valid.");
    if (body.action !== "approve" && body.action !== "decline") throw new UserFacingError("Choose approve or decline.");
    const db = getDb();
    const row = db.prepare("SELECT email, name, requested_role AS role FROM users WHERE id = ? AND requested_role IS NOT NULL").get(id as number) as
      | { email: string; name: string | null; role: "tutor" | "director" }
      | undefined;
    if (!row) throw new NotFoundError("That request is no longer there.");
    if (body.action === "approve") {
      db.prepare(
        `INSERT INTO allowed_users (email, name, role, active) VALUES (?, ?, ?, 1)
         ON CONFLICT(email) DO UPDATE SET name = COALESCE(name, excluded.name), role = excluded.role, active = 1`,
      ).run(row.email.toLowerCase(), row.name, row.role);
    }
    db.prepare("UPDATE users SET requested_role = NULL WHERE id = ?").run(id as number);
    return { ok: true };
  });
}
