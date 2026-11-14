import { handle } from "@/lib/api";
import { getDb } from "@/lib/db";
import type { QuizResult } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(req, async (user) => {
    const results = getDb()
      .prepare("SELECT id, created_at, score, total, topic FROM quiz_results WHERE user_id = ? ORDER BY id DESC LIMIT 20")
      .all(user.id) as QuizResult[];
    return { results };
  });
}
