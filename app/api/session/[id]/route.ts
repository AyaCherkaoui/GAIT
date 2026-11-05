import { handle } from "@/lib/api";
import { UserFacingError } from "@/lib/claude";
import { getSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = getSession(Number((await params).id));
    if (!session) throw new UserFacingError("Session not found.");
    return { session };
  });
}
