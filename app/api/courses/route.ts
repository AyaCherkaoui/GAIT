import { handle, readJson, requireDirector, str } from "@/lib/api";
import { getCourse, MAX_COURSE_BODY, MAX_SYLLABUS, saveCourse, validateUnits } from "@/lib/courses";

export const dynamic = "force-dynamic";

/** Tutors and the director read the one shared English 101 course. */
export async function GET(req: Request) {
  return handle(req, async () => getCourse());
}

/** Only the director sets it. The body limit is larger than the default because a syllabus can be long. */
export async function PUT(req: Request) {
  return handle(req, async (user) => {
    requireDirector(user);
    const body = await readJson(req, MAX_COURSE_BODY);
    const syllabus = str(body.syllabus, MAX_SYLLABUS);
    const units = validateUnits(body.units ?? []);
    saveCourse(syllabus, units);
    return getCourse();
  });
}
