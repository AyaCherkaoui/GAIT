import { getDb } from "./db";
import { AI_POLICIES, type AiPolicy, type CoursePolicy } from "./types";

/** "engl  101" -> "ENGL 101" so lookups ignore case and spacing. */
export function normalizeCode(code: string): string {
  return code.trim().replace(/\s+/g, " ").toUpperCase();
}

const COLS = "course_code, professor, policy, details, source, updated_at";

/** Policies are per tutor: each tutor saves and sees their own. */
export function getPolicy(code: string, userId: number): CoursePolicy | null {
  const c = normalizeCode(code);
  if (!c) return null;
  const row = getDb().prepare(`SELECT ${COLS} FROM course_policies WHERE course_code = ? AND user_id = ?`).get(c, userId);
  return (row as CoursePolicy | undefined) ?? null;
}

export function searchPolicies(q: string, userId: number): CoursePolicy[] {
  const like = `%${normalizeCode(q)}%`;
  return getDb()
    .prepare(`SELECT ${COLS} FROM course_policies WHERE user_id = ? AND (course_code LIKE ? OR UPPER(professor) LIKE ?) ORDER BY course_code LIMIT 100`)
    .all(userId, like, like) as CoursePolicy[];
}

export function savePolicy(p: { courseCode: string; professor?: string; policy?: string; details?: string; source?: string }, userId: number): CoursePolicy {
  const code = normalizeCode(p.courseCode ?? "");
  if (!code) throw new Error("Add a course code, like ENGL 101.");
  const policy: AiPolicy = AI_POLICIES.includes(p.policy as AiPolicy) ? (p.policy as AiPolicy) : "unknown";
  getDb()
    .prepare(
      `INSERT INTO course_policies (user_id, course_code, professor, policy, details, source, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, course_code) DO UPDATE SET professor = excluded.professor, policy = excluded.policy,
         details = excluded.details, source = excluded.source, updated_at = datetime('now')`,
    )
    .run(userId, code, p.professor ?? "", policy, p.details ?? "", p.source ?? "");
  return getPolicy(code, userId)!;
}
