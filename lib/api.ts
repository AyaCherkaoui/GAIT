import { NextResponse } from "next/server";
import { UserFacingError } from "./claude";

export async function handle(fn: () => Promise<unknown>) {
  try {
    return NextResponse.json(await fn());
  } catch (e) {
    console.error(e);
    const known = e instanceof UserFacingError;
    const message = known ? e.message : `Something went wrong: ${e instanceof Error ? e.message : String(e)}`;
    return NextResponse.json({ error: message }, { status: known ? 400 : 500 });
  }
}
