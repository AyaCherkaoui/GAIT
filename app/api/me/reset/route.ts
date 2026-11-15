import { handle, HttpError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { testToolsOn } from "@/lib/test-tools";

export const dynamic = "force-dynamic";

/** Testing only (GAIT_TEST_TOOLS=1): forget the role choice so the person sees the role chooser again. */
export async function POST(req: Request) {
  return handle(req, async (user) => {
    if (!testToolsOn()) throw new HttpError(404, "Not found.");
    const db = getDb();
    const email = user.email.toLowerCase();
    if (email !== process.env.DIRECTOR_EMAIL?.trim().toLowerCase()) db.prepare("DELETE FROM allowed_users WHERE email = ?").run(email);
    db.prepare("UPDATE users SET onboarded = 0, requested_role = NULL WHERE id = ?").run(user.id);
    return { ok: true };
  }, { tutee: true });
}
