import { getDb } from "./db";
import type { SessionRecord } from "./types";

export function getSession(id: number): SessionRecord | null {
  const row = getDb().prepare("SELECT * FROM sessions WHERE id = ?").get(id) as
    | { id: number; created_at: string; student_name: string; course: string; notes: string; outputs: string }
    | undefined;
  if (!row) return null;
  return { ...row, notes: JSON.parse(row.notes), outputs: JSON.parse(row.outputs) };
}
