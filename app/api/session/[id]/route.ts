import { handle } from "@/lib/api";
import { NotFoundError } from "@/lib/claude";
import { getSession, getSessionForDirector } from "@/lib/sessions";

export const dynamic = "force-dynamic";

/** The owner reads their own session. The director may also read any tutor's session, read-only and without the private concern. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(req, async (user) => {
    const id = Number((await params).id);
    const own = getSession(id, user.id);
    if (own) return { session: own };
    if (user.role === "director" && Number.isInteger(id)) {
      const session = getSessionForDirector(id);
      if (session) return { session, readOnly: true, tutor: session.tutor };
    }
    throw new NotFoundError("Session not found.");
  });
}
