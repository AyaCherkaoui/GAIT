import { handle, readJson, str } from "@/lib/api";
import { askJson, UserFacingError } from "@/lib/claude";
import { getCourse } from "@/lib/courses";

export const dynamic = "force-dynamic";

const SYSTEM = `A writing-center tutor is working with an English 101 student on one course unit. Write a short practice exercise the tutor can give the student during the session. Use questions and tasks only. Never write model answers, sample paragraphs or the student's work. Return:
{"title": "short exercise name", "tasks": ["3-5 questions or tasks the student does themselves"], "tutorNote": "one sentence on what to listen for"}`;

/** Made on demand from the unit's title and goal. Nothing is stored. */
export async function POST(req: Request) {
  return handle(req, async () => {
    const body = await readJson(req);
    const index = Number(body.unit);
    const units = getCourse().units;
    if (!Number.isInteger(index) || index < 0 || index >= units.length) throw new UserFacingError("Pick a unit first.");
    const note = str(body.note, 500);
    const u = units[index];
    const out = await askJson<{ title?: unknown; tasks?: unknown; tutorNote?: unknown }>({
      system: SYSTEM,
      messages: [{ role: "user", content: `Unit: ${u.title}\nGoal: ${u.goal}${note ? `\nTutor note: ${note}` : ""}` }],
    });
    const tasks = Array.isArray(out.tasks) ? out.tasks.filter((t): t is string => typeof t === "string").slice(0, 6) : [];
    if (!tasks.length) throw new UserFacingError("The AI reply was not in the expected format. Try again.");
    return { title: typeof out.title === "string" ? out.title : u.title, tasks, tutorNote: typeof out.tutorNote === "string" ? out.tutorNote : "" };
  }, { ai: true });
}
