import { handle, readJson, str } from "@/lib/api";
import { getTutee, renameTutee, timeline } from "@/lib/tutees";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(req, async (user) => {
    const t = getTutee(Number((await params).id), user.id);
    return { tutee: t, sessions: timeline(t.id, user.id) };
  });
}

/** Rename: the tutor fixes a first name or tells two students apart. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(req, async (user) => {
    const id = Number((await params).id);
    getTutee(id, user.id); // 404 before the body is read, for anyone but the owner
    const body = await readJson(req);
    renameTutee(id, user.id, str(body.firstName, 60));
    return { ok: true };
  });
}
