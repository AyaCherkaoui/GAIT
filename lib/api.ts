import { NextResponse } from "next/server";
import { NotFoundError, UserFacingError } from "./claude";

export async function handle(fn: () => Promise<unknown>) {
  try {
    return NextResponse.json(await fn());
  } catch (e) {
    console.error(e);
    const known = e instanceof UserFacingError;
    const message = known ? e.message : `Something went wrong: ${e instanceof Error ? e.message : String(e)}`;
    return NextResponse.json({ error: message }, { status: e instanceof NotFoundError ? 404 : known ? 400 : 500 });
  }
}
