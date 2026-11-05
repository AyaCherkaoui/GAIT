import { handle } from "@/lib/api";
import { UserFacingError } from "@/lib/claude";
import { getPolicy, savePolicy, searchPolicies } from "@/lib/policies";

export const dynamic = "force-dynamic";

/** GET /api/policies?code=ENGL 101 looks one course up; ?q=text searches (empty lists all). */
export async function GET(req: Request) {
  return handle(async () => {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    if (code !== null) return { policy: getPolicy(code) };
    return { policies: searchPolicies(url.searchParams.get("q") ?? "") };
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const body = (await req.json()) as { courseCode?: string; professor?: string; policy?: string; details?: string; source?: string };
    if (!body.courseCode?.trim()) throw new UserFacingError("Add a course code, like ENGL 101.");
    return { policy: savePolicy({ ...body, courseCode: body.courseCode }) };
  });
}
