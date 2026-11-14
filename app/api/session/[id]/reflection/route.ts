import { handle } from "@/lib/api";
import { NotFoundError, UserFacingError } from "@/lib/claude";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/sessions";
import type { Reflection } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(req, async (user) => {
    const id = Number((await params).id);
    if (!getSession(id, user.id)) throw new NotFoundError("Session not found.");
    const b = (await req.json()) as Partial<Reflection>;
    const str = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 4000) : "");
    const reflection: Reflection = {
      learned: str(b.learned),
      wantToImprove: str(b.wantToImprove),
      wentWell: str(b.wentWell),
      goalNextTime: str(b.goalNextTime),
      updatedAt: new Date().toISOString(),
    };
    if (!reflection.learned && !reflection.wantToImprove && !reflection.wentWell && !reflection.goalNextTime) {
      throw new UserFacingError("Write at least one reflection before saving.");
    }
    getDb().prepare("UPDATE sessions SET reflection = ? WHERE id = ? AND user_id = ?").run(JSON.stringify(reflection), id, user.id);
    return { reflection };
  });
}
