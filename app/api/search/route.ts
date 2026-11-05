import { handle } from "@/lib/api";
import { UserFacingError } from "@/lib/claude";
import { docCount, smartSearch } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => ({ docs: docCount() }));
}

export async function POST(req: Request) {
  return handle(async () => {
    const { q } = (await req.json()) as { q?: string };
    if (!q?.trim()) throw new UserFacingError("Type what you are looking for.");
    return smartSearch(q.trim());
  });
}
