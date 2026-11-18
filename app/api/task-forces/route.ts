import { handle, HttpError, readJson, requireDirector, str } from "@/lib/api";
import { NotFoundError } from "@/lib/claude";
import { getDb } from "@/lib/db";
import { TASK_FORCES, taskForce } from "@/lib/task-forces";

export const dynamic = "force-dynamic";

// A member counts unless the director deactivated them (a deactivated tutor frees the seat).
const SEATED = `FROM task_force_members m JOIN users u ON u.id = m.user_id
  LEFT JOIN allowed_users a ON a.email = lower(u.email) WHERE COALESCE(a.active, 1) = 1`;

function shortName(name: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "A tutor";
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
}

function list(userId: number) {
  const db = getDb();
  const rows = db.prepare(`SELECT m.task_force_key AS key, m.user_id AS id, u.name AS name ${SEATED} ORDER BY m.joined_at, m.user_id`).all() as { key: string; id: number; name: string | null }[];
  const mine = rows.find((r) => r.id === userId)?.key ?? null;
  const taskForces = TASK_FORCES.map((t) => {
    const members = rows.filter((r) => r.key === t.key);
    return { key: t.key, name: t.name, max: t.max, scholars: t.scholars, description: t.description, count: members.length, members: members.map((r) => shortName(r.name)), full: t.max !== null && members.length >= t.max };
  });
  return { taskForces, mine };
}

/** Puts a person in a task force (or takes them out with key null) inside one transaction, so the cap holds. */
function place(userId: number, key: string | null) {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    if (key === null) {
      db.prepare("DELETE FROM task_force_members WHERE user_id = ?").run(userId);
    } else {
      const t = taskForce(key)!;
      if (t.max !== null) {
        const n = (db.prepare(`SELECT COUNT(*) AS n ${SEATED} AND m.task_force_key = ? AND m.user_id != ?`).get(key, userId) as { n: number }).n;
        if (n >= t.max) throw new HttpError(409, `${t.name} is full.`);
      }
      db.prepare(
        `INSERT INTO task_force_members (user_id, task_force_key) VALUES (?, ?)
         ON CONFLICT(user_id) DO UPDATE SET task_force_key = excluded.task_force_key, joined_at = datetime('now')`,
      ).run(userId, key);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export async function GET(req: Request) {
  return handle(req, async (user) => list(user.id), { tutee: true });
}

/** A tutor (or a person who asked to be one) joins or moves to a task force. Only your own membership. */
export async function POST(req: Request) {
  return handle(req, async (user) => {
    if (user.role === "director") throw new HttpError(403, "The director places people from the Tutors page.");
    if (user.role === "tutee" && user.requestedRole !== "tutor") throw new HttpError(403, "Task forces are for tutors.");
    const body = await readJson(req);
    const t = taskForce(body.key);
    if (!t) throw new HttpError(400, "Choose a task force from the list.");
    if (t.scholars) throw new HttpError(403, "The director places RWC Scholars.");
    place(user.id, t.key);
    return list(user.id);
  }, { tutee: true });
}

/** A tutor leaves their own task force. */
export async function DELETE(req: Request) {
  return handle(req, async (user) => {
    if (user.role === "director") throw new HttpError(403, "The director places people from the Tutors page.");
    place(user.id, null);
    return list(user.id);
  }, { tutee: true });
}

/** Director only: place, move or remove anyone (key null removes). */
export async function PUT(req: Request) {
  return handle(req, async (user) => {
    requireDirector(user);
    const body = await readJson(req);
    const email = str(body.email, 254).trim().toLowerCase();
    const target = getDb().prepare("SELECT id FROM users WHERE lower(email) = ?").get(email) as { id: number } | undefined;
    if (!target) throw new NotFoundError("That person has not signed in yet.");
    if (body.key === null) place(target.id, null);
    else {
      if (!taskForce(body.key)) throw new HttpError(400, "Choose a task force from the list.");
      place(target.id, body.key as string);
    }
    return list(user.id);
  });
}
