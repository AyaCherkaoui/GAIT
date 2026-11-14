import { handle } from "@/lib/api";
import { getDb } from "@/lib/db";
import type { QuizResult } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const results = getDb()
      .prepare("SELECT id, created_at, score, total, topic FROM quiz_results ORDER BY id DESC LIMIT 20")
      .all() as QuizResult[];
    return { results };
  });
}
