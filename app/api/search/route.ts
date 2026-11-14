import { handle, readJson, str } from "@/lib/api";
import { UserFacingError } from "@/lib/claude";
import { docCount, smartSearch } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(req, async () => ({ docs: docCount() }));
}

export async function POST(req: Request) {
  return handle(req, async () => {
    const q = str((await readJson(req)).q, 500).trim();
    if (!q) throw new UserFacingError("Type what you are looking for.");
    return smartSearch(q);
  }, { ai: true });
}
