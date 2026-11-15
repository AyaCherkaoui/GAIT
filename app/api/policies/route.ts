import { handle, readJson, str } from "@/lib/api";
import { UserFacingError } from "@/lib/claude";
import { getPolicy, savePolicy, searchPolicies } from "@/lib/policies";

export const dynamic = "force-dynamic";

/** GET /api/policies?code=ENGL 101 looks one course up; ?q=text searches (empty lists all). Each tutor sees their own. */
export async function GET(req: Request) {
  return handle(req, async (user) => {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    if (code !== null) return { policy: getPolicy(code.slice(0, 40), user.id) };
    return { policies: searchPolicies((url.searchParams.get("q") ?? "").slice(0, 100), user.id) };
  });
}

export async function POST(req: Request) {
  return handle(req, async (user) => {
    const body = await readJson(req);
    const courseCode = str(body.courseCode, 40);
    if (!courseCode.trim()) throw new UserFacingError("Add a course code, like ENGL 101.");
    return {
      policy: savePolicy(
        { courseCode, professor: str(body.professor, 200), policy: str(body.policy, 20), details: str(body.details, 2000), source: str(body.source, 500) },
        user.id,
      ),
    };
  });
}
