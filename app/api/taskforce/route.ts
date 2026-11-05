import { handle } from "@/lib/api";
import { askJson, UserFacingError } from "@/lib/claude";
import { getDb } from "@/lib/db";
import { docCount, smartSearch } from "@/lib/search";
import type { Hit, TaskPlan } from "@/lib/types";

export const dynamic = "force-dynamic";

const SYSTEM = `A writing-center tutor is working on a task force assignment (a project for the center, such as a workshop, a handout, outreach, or a report). This output is for the tutor. Help them get started. Return:
{"steps": ["5-8 concrete steps in order"], "outline": "a starting outline in plain text with short headings and bullets", "questionsToClarify": ["2-4 questions to ask the task force lead or director"]}`;

export async function GET() {
  return handle(async () => {
    const rows = getDb().prepare("SELECT * FROM tasks ORDER BY id DESC LIMIT 50").all() as {
      id: number; created_at: string; title: string; description: string; plan: string; related: string;
    }[];
    return { tasks: rows.map((r) => ({ ...r, plan: JSON.parse(r.plan), related: JSON.parse(r.related || "[]") })) };
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { title = "", description = "" } = (await req.json()) as { title?: string; description?: string };
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
      .prepare("INSERT INTO tasks (title, description, plan, related) VALUES (?, ?, ?, ?)")
      .run(title, description, JSON.stringify(plan), JSON.stringify(related));
    return { id: Number(info.lastInsertRowid), plan, related };
  });
}
