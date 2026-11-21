import { handle, readJson, str } from "@/lib/api";
import { askJson, UserFacingError } from "@/lib/claude";
import { getDb } from "@/lib/db";
import { docCount, smartSearch } from "@/lib/search";
import type { Hit, TaskPlan } from "@/lib/types";

export const dynamic = "force-dynamic";

const SYSTEM = `A writing-center tutor is working on a task force assignment (a project for the center, such as a workshop, a handout, outreach, or a report). This output is for the tutor. Help them get started. Return:
{"steps": ["5-8 concrete steps in order"], "outline": "a starting outline in plain text with short headings and bullets", "questionsToClarify": ["2-4 questions to ask the task force lead or director"]}`;

export async function GET(req: Request) {
  return handle(req, async (user) => {
    const rows = getDb().prepare("SELECT id, created_at, title, description, plan, related, task_force FROM tasks WHERE user_id = ? ORDER BY id DESC LIMIT 50").all(user.id) as {
      id: number; created_at: string; title: string; description: string; plan: string; related: string; task_force: string | null;
    }[];
    return { tasks: rows.map((r) => ({ ...r, plan: JSON.parse(r.plan), related: JSON.parse(r.related || "[]") })) };
  });
}

export async function POST(req: Request) {
  return handle(req, async (user) => {
    const body = await readJson(req);
    const title = str(body.title, 300);
    const description = str(body.description, 8000);
    if (!title.trim() && !description.trim()) throw new UserFacingError("Describe the task first.");
    const plan = await askJson<TaskPlan>({
      system: SYSTEM,
      messages: [{ role: "user", content: `Task: ${title}\n\nDetails: ${description}` }],
    });
    let related: Hit[] = [];
    if (docCount() > 0) {
      related = (await smartSearch(`${title}. ${description}`.slice(0, 500)).catch(() => ({ hits: [] }))).hits;
    }
    const info = getDb()
      .prepare("INSERT INTO tasks (title, description, plan, related, user_id, task_force) VALUES (?, ?, ?, ?, ?, (SELECT task_force_key FROM task_force_members WHERE user_id = ?))")
      .run(title, description, JSON.stringify(plan), JSON.stringify(related), user.id, user.id);
    return { id: Number(info.lastInsertRowid), plan, related };
  }, { ai: true });
}

/** Saves which steps of a task are ticked. Only the owner's own task can change. */
export async function PUT(req: Request) {
  return handle(req, async (user) => {
    const body = await readJson(req);
    const id = Number(body.id);
    if (!Number.isInteger(id) || !Array.isArray(body.done) || body.done.length > 50) throw new UserFacingError("The request was not valid.");
    const row = getDb().prepare("SELECT plan FROM tasks WHERE id = ? AND user_id = ?").get(id, user.id) as { plan: string } | undefined;
    if (!row) throw new UserFacingError("That task was not found.");
    const plan = JSON.parse(row.plan) as TaskPlan;
    plan.done = [...new Set((body.done as unknown[]).filter((n): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < plan.steps.length))];
    getDb().prepare("UPDATE tasks SET plan = ? WHERE id = ? AND user_id = ?").run(JSON.stringify(plan), id, user.id);
    return { done: plan.done };
  });
}
