import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { impactByWeek, toCsv } from "@/lib/impact";

export const dynamic = "force-dynamic";

/** A tutor sees their own numbers; the director sees everyone's. */
export async function GET(req: Request) {
  const csv = new URL(req.url).searchParams.get("format") === "csv";
  const res = await handle(req, async (user) => {
    const rows = impactByWeek(user.role === "director" ? null : user.id);
    return csv ? { csv: toCsv(rows) } : { weeks: rows };
  });
  if (!csv || !res.ok) return res;
  const { csv: body } = (await res.json()) as { csv: string };
  return new NextResponse(body, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="gait-impact.csv"' },
  });
}
