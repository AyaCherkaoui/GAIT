import { getDb } from "./db";
import { UserFacingError } from "./claude";

export type Unit = { title: string; goal: string; minutes: number };
export type Course = { syllabus: string; units: Unit[]; updated_at: string | null };

export const MAX_SYLLABUS = 150_000; // characters saved
export const MAX_COURSE_BODY = 200_000; // bytes accepted by the course route
export const MAX_UNITS = 20;
export const PROPOSE_INPUT = 12_000; // characters of syllabus sent to the AI

export function getCourse(): Course {
  const row = getDb().prepare("SELECT syllabus_text, units, updated_at FROM courses WHERE id = 1").get() as { syllabus_text: string; units: string; updated_at: string } | undefined;
  if (!row) return { syllabus: "", units: [], updated_at: null };
  let units: Unit[] = [];
  try { units = validateUnits(JSON.parse(row.units)); } catch { /* bad stored units show as none */ }
  return { syllabus: row.syllabus_text, units, updated_at: row.updated_at };
}

/** Units are title, goal and minutes (5 to 180). Anything else is refused. */
export function validateUnits(v: unknown): Unit[] {
  if (!Array.isArray(v) || v.length > MAX_UNITS) throw new UserFacingError("The units were not valid.");
  return v.map((u) => {
    const o = (u ?? {}) as Record<string, unknown>;
    const minutes = Number(o.minutes);
    if (typeof o.title !== "string" || !o.title.trim() || o.title.length > 120) throw new UserFacingError("Each unit needs a title.");
    if (o.goal !== undefined && (typeof o.goal !== "string" || o.goal.length > 400)) throw new UserFacingError("A unit goal is too long.");
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 180) throw new UserFacingError("Unit minutes must be a whole number from 5 to 180.");
    return { title: o.title.trim(), goal: ((o.goal as string) ?? "").trim(), minutes };
  });
}

export function saveCourse(syllabus: string, units: Unit[]) {
  getDb()
    .prepare("INSERT INTO courses (id, syllabus_text, units, updated_at) VALUES (1, ?, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET syllabus_text = excluded.syllabus_text, units = excluded.units, updated_at = excluded.updated_at")
    .run(syllabus, JSON.stringify(units));
}
