/** Client-safe types for course AI policies (lib/policies.ts uses the database). */
export type AiPolicy = "allowed" | "limited" | "banned" | "unknown";
export const AI_POLICIES: AiPolicy[] = ["allowed", "limited", "banned", "unknown"];
export type CoursePolicy = { course_code: string; professor: string; policy: AiPolicy; details: string; source: string; updated_at: string };
