import { getDb } from "./db";
import type { Reflection, SessionNotes, SessionRecord, SessionSummary } from "./types";

type Row = {
  id: number; created_at: string; student_name: string; course: string;
  notes: string; outputs: string; reflection: string | null;
};

export function parseReflection(raw: string | null): Reflection | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Reflection;
  } catch {
    return null;
  }
}

export function getSession(id: number, userId: number): SessionRecord | null {
  const row = getDb()
    .prepare("SELECT id, created_at, student_name, course, notes, outputs, reflection FROM sessions WHERE id = ? AND user_id = ?")
    .get(id, userId) as Row | undefined;
  if (!row) return null;
  return {
    id: row.id,
    created_at: row.created_at,
    student_name: row.student_name,
    course: row.course,
    notes: JSON.parse(row.notes),
    outputs: JSON.parse(row.outputs),
    reflection: parseReflection(row.reflection),
  };
}

/** The first clause of "worked on", short enough for a table cell. */
function shortFocus(v: string | null): string {
  const t = (v ?? "").trim().split(/[.;\n]/)[0].trim();
  return t.length > 48 ? `${t.slice(0, 47).trimEnd()}…` : t;
}

export function listSessions(userId: number): SessionSummary[] {
  const rows = getDb()
    .prepare("SELECT id, created_at, student_name, course, reflection, json_extract(notes, '$.workedOn') AS focus FROM sessions WHERE user_id = ? ORDER BY id DESC LIMIT 50")
    .all(userId) as (Omit<Row, "notes" | "outputs"> & { focus: string | null })[];
  return rows.map((r) => ({ ...r, focus: shortFocus(r.focus), reflection: parseReflection(r.reflection) }));
}

/** The tutor's own words are kept private: the director never gets the private concern, and sees only the student's first name. */
function forDirector(row: Row & { tutor: string }): SessionRecord & { tutor: string } {
  const { privateConcern: _private, ...notes } = JSON.parse(row.notes) as SessionNotes;
  return {
    id: row.id,
    created_at: row.created_at,
    student_name: row.student_name.trim().split(/\s+/)[0] ?? "",
    course: row.course,
    notes,
    outputs: JSON.parse(row.outputs),
    reflection: null,
    tutor: row.tutor,
  };
}

/** Read-only view of any tutor's session for the director. Callers must check the director role first. Rows with no owner stay hidden. */
export function getSessionForDirector(id: number): (SessionRecord & { tutor: string }) | null {
  const row = getDb()
    .prepare(
      `SELECT s.id, s.created_at, s.student_name, s.course, s.notes, s.outputs, s.reflection, COALESCE(NULLIF(u.name, ''), u.email) AS tutor
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    )
    .get(id) as (Row & { tutor: string }) | undefined;
  return row ? forDirector(row) : null;
}

export type DirectorSessionRow = { id: number; created_at: string; tutor: string; student: string; course: string };

/** Every tutor's sessions, newest first: date, tutor, the student's first name and the course. Callers must check the director role first. */
export function listSessionsForDirector(): DirectorSessionRow[] {
  const rows = getDb()
    .prepare(
      `SELECT s.id, s.created_at, s.student_name, s.course, COALESCE(NULLIF(u.name, ''), u.email) AS tutor
       FROM sessions s JOIN users u ON u.id = s.user_id ORDER BY s.id DESC LIMIT 200`,
    )
    .all() as { id: number; created_at: string; student_name: string; course: string; tutor: string }[];
  return rows.map((r) => ({ id: r.id, created_at: r.created_at, tutor: r.tutor, student: r.student_name.trim().split(/\s+/)[0] ?? "", course: r.course }));
}
