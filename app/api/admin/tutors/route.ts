import { handle, HttpError, readJson, requireDirector, str } from "@/lib/api";
import { NotFoundError, UserFacingError } from "@/lib/claude";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanEmail(value: unknown): string {
  const email = str(value, 254).trim().toLowerCase();
  if (!EMAIL.test(email)) throw new UserFacingError("Enter a valid email address.");
  return email;
}

export async function GET(req: Request) {
  return handle(req, async (user) => {
    requireDirector(user);
    const tutors = getDb().prepare("SELECT email, name, role, active, added_at FROM allowed_users ORDER BY added_at, email").all();
    const requests = getDb()
      .prepare(
        `SELECT u.id, u.email, u.name, u.requested_role AS role FROM users u
         LEFT JOIN allowed_users a ON a.email = lower(u.email)
         WHERE u.requested_role IS NOT NULL AND COALESCE(a.active, 0) = 0 ORDER BY u.id`,
      )
      .all();
    return { tutors, requests };
  });
}

export async function POST(req: Request) {
  return handle(req, async (user) => {
    requireDirector(user);
    const body = await readJson(req);
    const email = cleanEmail(body.email);
    const name = str(body.name, 100).trim() || null;
    const role = body.role;
    if (role !== "tutor" && role !== "director") throw new UserFacingError("Choose tutor or director.");
    if (email === user.email.toLowerCase() && role !== "director") throw new HttpError(400, "You cannot change your own role.");
    getDb()
      .prepare(
        `INSERT INTO allowed_users (email, name, role, active) VALUES (?, ?, ?, 1)
         ON CONFLICT(email) DO UPDATE SET name = COALESCE(excluded.name, name), role = excluded.role, active = 1`,
      )
      .run(email, name, role);
    return { ok: true };
  });
}

export async function DELETE(req: Request) {
  return handle(req, async (user) => {
    requireDirector(user);
    const email = cleanEmail(new URL(req.url).searchParams.get("email"));
    if (email === user.email.toLowerCase()) throw new HttpError(400, "You cannot deactivate yourself.");
    const info = getDb().prepare("UPDATE allowed_users SET active = 0 WHERE email = ?").run(email);
    if (!info.changes) throw new NotFoundError("That email is not on the list.");
    return { ok: true };
  });
}
