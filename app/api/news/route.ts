import { handle } from "@/lib/api";
import { getNews } from "@/lib/news";

export const dynamic = "force-dynamic";

/** GET /api/news returns the latest articles; ?refresh=1 asks the sources again (at most once a minute each). Tutors and the director only. */
export async function GET(req: Request) {
  return handle(req, async () => getNews(new URL(req.url).searchParams.get("refresh") === "1"));
}
