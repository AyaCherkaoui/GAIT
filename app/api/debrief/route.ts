import { handle, HttpError, rateLimit, readJson, str } from "@/lib/api";
import { UserFacingError } from "@/lib/claude";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const DRAINING = 4; // a rating of 4 or 5 counts as a draining shift
const NUDGE_AT = 3;

type Row = { week: string; shifts: number; avg: number; draining: number };

/** Private to the signed-in user: nobody else, the director included, can read these rows. Weeks start on Monday. */
export async function GET(req: Request) {
  return handle(req, async (user) => {
    const weeks = getDb()
      .prepare(
        `SELECT date(created_at, 'weekday 0', '-6 days') AS week, COUNT(*) AS shifts,
                ROUND(AVG(drain), 1) AS avg, SUM(CASE WHEN drain >= ? THEN 1 ELSE 0 END) AS draining
         FROM debriefs WHERE user_id = ? GROUP BY week ORDER BY week DESC LIMIT 8`,
      )
      .all(DRAINING, user.id) as Row[];
    const thisWeek = getDb()
      .prepare(`SELECT COUNT(*) AS n FROM debriefs WHERE user_id = ? AND drain >= ? AND date(created_at, 'weekday 0', '-6 days') = date('now', 'weekday 0', '-6 days')`)
      .get(user.id, DRAINING) as { n: number };
    return { weeks, nudge: thisWeek.n >= NUDGE_AT };
  });
}

export async function POST(req: Request) {
  return handle(req, async (user) => {
    if (!rateLimit(`debrief:${user.id}`, 10, 3600_000)) throw new HttpError(429, "Too many check-ins. Try again later.");
    const body = await readJson(req);
    const drain = Number(body.drain);
    if (!Number.isInteger(drain) || drain < 1 || drain > 5) throw new UserFacingError("Pick a rating from 1 to 5.");
    getDb().prepare("INSERT INTO debriefs (drain, note, user_id) VALUES (?, ?, ?)").run(drain, str(body.note, 500), user.id);
    return { ok: true };
  });
}
