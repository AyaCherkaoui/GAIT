import { handle } from "@/lib/api";
import { providerStatus } from "@/lib/claude";

export const dynamic = "force-dynamic";

/** Which provider and model are active. Never includes a key. */
export async function GET(req: Request) {
  return handle(req, async () => providerStatus());
}
