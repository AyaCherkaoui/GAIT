import { getDb } from "./db";
import type { Reflection, SessionRecord, SessionSummary } from "./types";

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

export function getSession(id: number): SessionRecord | null {
  const row = getDb()
    .prepare("SELECT id, created_at, student_name, course, notes, outputs, reflection FROM sessions WHERE id = ?")
    .get(id) as Row | undefined;
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

export function listSessions(): SessionSummary[] {
  const rows = getDb()
    .prepare("SELECT id, created_at, student_name, course, reflection FROM sessions ORDER BY id DESC LIMIT 50")
    .all() as Omit<Row, "notes" | "outputs">[];
  return rows.map((r) => ({ ...r, reflection: parseReflection(r.reflection) }));
}
