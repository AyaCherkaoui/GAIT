import { handle } from "@/lib/api";
import { UserFacingError } from "@/lib/claude";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const DRAINING = 4; // a rating of 4 or 5 counts as a draining shift
const NUDGE_AT = 3;

type Row = { week: string; shifts: number; avg: number; draining: number };

/** Weeks start on Monday. Everything stays in the local database and is never exported. */
export async function GET() {
  return handle(async () => {
    const weeks = getDb()
      .prepare(
        `SELECT date(created_at, 'weekday 0', '-6 days') AS week, COUNT(*) AS shifts,
                ROUND(AVG(drain), 1) AS avg, SUM(CASE WHEN drain >= ? THEN 1 ELSE 0 END) AS draining
         FROM debriefs GROUP BY week ORDER BY week DESC LIMIT 8`,
      )
      .all(DRAINING) as Row[];
    const thisWeek = getDb()
      .prepare(`SELECT COUNT(*) AS n FROM debriefs WHERE drain >= ? AND date(created_at, 'weekday 0', '-6 days') = date('now', 'weekday 0', '-6 days')`)
      .get(DRAINING) as { n: number };
    return { weeks, nudge: thisWeek.n >= NUDGE_AT };
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const body = (await req.json()) as { drain?: number; note?: string };
    const drain = Number(body.drain);
    if (!Number.isInteger(drain) || drain < 1 || drain > 5) throw new UserFacingError("Pick a rating from 1 to 5.");
    getDb().prepare("INSERT INTO debriefs (drain, note) VALUES (?, ?)").run(drain, (body.note ?? "").slice(0, 500));
    return { ok: true };
  });
}
