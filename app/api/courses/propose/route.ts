import { handle, readJson, requireDirector, str } from "@/lib/api";
import { askJson, UserFacingError } from "@/lib/claude";
import { MAX_COURSE_BODY, MAX_SYLLABUS, PROPOSE_INPUT, validateUnits } from "@/lib/courses";

export const dynamic = "force-dynamic";

const SYSTEM = `A writing-center director is setting up English 101 tutoring. Read the course syllabus and propose the course units a tutor will work through with a student, in order. This output is for the director to edit. Return:
{"units": [{"title": "short unit name", "goal": "one sentence: what the student should be able to do", "minutes": 20}]}
Give 3 to 10 units. Minutes are a whole number from 10 to 60.`;

/** Director only: proposes units from the syllabus text. The director edits them before saving. */
export async function POST(req: Request) {
  return handle(req, async (user) => {
    requireDirector(user);
    const syllabus = str((await readJson(req, MAX_COURSE_BODY)).syllabus, MAX_SYLLABUS).trim();
    if (!syllabus) throw new UserFacingError("Load or paste the syllabus first.");
    const out = await askJson<{ units?: unknown }>({ system: SYSTEM, messages: [{ role: "user", content: syllabus.slice(0, PROPOSE_INPUT) }] });
    return { units: validateUnits(out.units) };
  }, { ai: true });
}
