import { getDb } from "@/lib/db";
import { TASK_FORCES } from "@/lib/task-forces";

// A member counts unless the director deactivated them (a deactivated tutor frees the seat).
export const SEATED = `FROM task_force_members m JOIN users u ON u.id = m.user_id
  LEFT JOIN allowed_users a ON a.email = lower(u.email) WHERE COALESCE(a.active, 1) = 1`;

/** "Nell N." from a full name: first name and last initial only. */
export function shortName(name: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "A tutor";
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
}

export function listTaskForces(userId: number) {
  const rows = getDb().prepare(`SELECT m.task_force_key AS key, m.user_id AS id, u.name AS name ${SEATED} ORDER BY m.joined_at, m.user_id`).all() as { key: string; id: number; name: string | null }[];
  const mine = rows.find((r) => r.id === userId)?.key ?? null;
  const taskForces = TASK_FORCES.map((t) => {
    const members = rows.filter((r) => r.key === t.key);
    return { key: t.key, name: t.name, max: t.max, scholars: t.scholars, description: t.description, count: members.length, members: members.map((r) => shortName(r.name)), full: t.max !== null && members.length >= t.max };
  });
  return { taskForces, mine };
}
