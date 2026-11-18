import { handle, readJson, str } from "@/lib/api";
import { UserFacingError } from "@/lib/claude";
import { findOrCreateTutee, firstNameOf, listTutees } from "@/lib/tutees";

export const dynamic = "force-dynamic";

/** A tutor's own tutees (first names only). Nobody else's are reachable, the director's included. */
export async function GET(req: Request) {
  return handle(req, async (user) => ({ tutees: listTutees(user.id) }));
}

export async function POST(req: Request) {
  return handle(req, async (user) => {
    const body = await readJson(req);
    const name = firstNameOf(str(body.firstName, 60));
    if (!name) throw new UserFacingError("Add a first name.");
    return { id: findOrCreateTutee(user.id, name) };
  });
}
