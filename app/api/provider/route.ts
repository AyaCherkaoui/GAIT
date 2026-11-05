import { NextResponse } from "next/server";
import { providerStatus } from "@/lib/claude";

export const dynamic = "force-dynamic";

/** Which provider and model are active. Never includes a key. */
export async function GET() {
  return NextResponse.json(await providerStatus());
}
