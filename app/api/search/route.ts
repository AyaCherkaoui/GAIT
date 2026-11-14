import { handle } from "@/lib/api";
import { UserFacingError } from "@/lib/claude";
import { docCount, smartSearch } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(req, async () => ({ docs: docCount() }));
}

export async function POST(req: Request) {
  return handle(req, async () => {
    const { q } = (await req.json()) as { q?: string };
    if (!q?.trim()) throw new UserFacingError("Type what you are looking for.");
    return smartSearch(q.trim());
  });
}
