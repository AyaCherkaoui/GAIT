import { NextResponse } from "next/server";
import { handle, requireDirector } from "@/lib/api";
import { impactByWeek, toCsv } from "@/lib/impact";

export const dynamic = "force-dynamic";

/** Director only: anonymous weekly counts for everyone, as JSON or (?format=csv) a download. */
export async function GET(req: Request) {
  const csv = new URL(req.url).searchParams.get("format") === "csv";
  const res = await handle(req, async (user) => {
    requireDirector(user);
    const rows = impactByWeek();
    return csv ? { csv: toCsv(rows) } : { weeks: rows };
  });
  if (!csv || !res.ok) return res;
  const { csv: body } = (await res.json()) as { csv: string };
  return new NextResponse(body, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="gait-impact.csv"' },
  });
}
