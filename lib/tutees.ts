import { getDb } from "./db";
import { NotFoundError, UserFacingError } from "./claude";
import { firstNameOf } from "./names";
import { parseReflection } from "./sessions";
import type { TimelineEntry, Tutee } from "./types";

export function findOrCreateTutee(userId: number, firstName: string): number {
  const db = getDb();
  db.prepare("INSERT OR IGNORE INTO tutees (user_id, first_name) VALUES (?, ?)").run(userId, firstName);
  return (db.prepare("SELECT id FROM tutees WHERE user_id = ? AND lower(first_name) = lower(?)").get(userId, firstName) as { id: number }).id;
}

/** The tutor's own tutee. Anyone else's (including for the director) is a 404. */
export function getTutee(id: number, userId: number): { id: number; first_name: string } {
  const row = Number.isInteger(id)
    ? (getDb().prepare("SELECT id, first_name FROM tutees WHERE id = ? AND user_id = ?").get(id, userId) as { id: number; first_name: string } | undefined)
    : undefined;
  if (!row) throw new NotFoundError("Tutee not found.");
  return row;
}

export function listTutees(userId: number): Tutee[] {
  return getDb()
    .prepare(
      `SELECT t.id, t.first_name, COUNT(s.id) AS sessions, MAX(s.created_at) AS last_at
       FROM tutees t LEFT JOIN sessions s ON s.tutee_id = t.id AND s.user_id = t.user_id
       WHERE t.user_id = ? GROUP BY t.id ORDER BY lower(t.first_name)`,
    )
    .all(userId) as Tutee[];
}

export function renameTutee(id: number, userId: number, firstName: string) {
  getTutee(id, userId);
  const name = firstNameOf(firstName);
  if (!name) throw new UserFacingError("Add a first name.");
  try {
    getDb().prepare("UPDATE tutees SET first_name = ? WHERE id = ? AND user_id = ?").run(name, id, userId);
  } catch {
    throw new UserFacingError("You already have a tutee with that name.");
  }
  getDb().prepare("UPDATE sessions SET student_name = ? WHERE tutee_id = ? AND user_id = ?").run(name, id, userId);
}

export function timeline(id: number, userId: number): TimelineEntry[] {
  getTutee(id, userId);
  const rows = getDb()
    .prepare("SELECT id, created_at, course, notes, reflection FROM sessions WHERE tutee_id = ? AND user_id = ? ORDER BY id DESC LIMIT 200")
    .all(id, userId) as { id: number; created_at: string; course: string; notes: string; reflection: string | null }[];
  return rows.map((r) => {
    const n = JSON.parse(r.notes) as { type?: string; focus?: string[]; minutes?: number };
    return { id: r.id, created_at: r.created_at, course: r.course, type: n.type, focus: n.focus, minutes: n.minutes, reflection: parseReflection(r.reflection) };
  });
}
