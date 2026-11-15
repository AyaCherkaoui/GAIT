import { handle, requireDirector } from "@/lib/api";
import { listSessionsForDirector } from "@/lib/sessions";

export const dynamic = "force-dynamic";

/** Director only: every tutor's sessions as date, tutor, the student's first name and the course. */
export async function GET(req: Request) {
  return handle(req, async (user) => {
    requireDirector(user);
    return { sessions: listSessionsForDirector() };
  });
}
