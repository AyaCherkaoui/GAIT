import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { impactByWeek, toCsv } from "@/lib/impact";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("format") === "csv") {
    try {
      return new NextResponse(toCsv(impactByWeek()), {
        headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="gait-impact.csv"' },
      });
    } catch (e) {
      return NextResponse.json({ error: `Something went wrong: ${(e as Error).message}` }, { status: 500 });
    }
  }
  return handle(async () => ({ weeks: impactByWeek() }));
}
