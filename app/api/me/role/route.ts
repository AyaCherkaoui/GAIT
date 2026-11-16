import { handle, HttpError, readJson } from "@/lib/api";
import { UserFacingError } from "@/lib/claude";
import { getDb } from "@/lib/db";
import { testToolsOn } from "@/lib/test-tools";

export const dynamic = "force-dynamic";

/** First sign-in only: records the choice. Tutor and director are requests; this never writes allowed_users. */
export async function POST(req: Request) {
  return handle(req, async (user) => {
    const { role } = await readJson(req);
    if (role !== "student" && role !== "tutor" && role !== "director") throw new UserFacingError("Choose student, tutor or director.");
    if (user.onboarded) throw new HttpError(409, "You already chose how to use Ink.");
    const info = getDb()
      .prepare("UPDATE users SET onboarded = 1, requested_role = ? WHERE id = ? AND onboarded = 0")
      .run(role === "student" ? null : role, user.id);
    if (!info.changes) throw new HttpError(409, "You already chose how to use Ink.");
    // Testing only: the chosen role takes effect at once, so every view can be tried without the director approving it.
    if (testToolsOn() && role !== "student") {
      getDb()
        .prepare(
          `INSERT INTO allowed_users (email, name, role, active) VALUES (?, ?, ?, 1)
           ON CONFLICT(email) DO UPDATE SET role = excluded.role, active = 1`,
        )
        .run(user.email.toLowerCase(), user.name, role);
    }
    return { ok: true };
  }, { tutee: true });
}
