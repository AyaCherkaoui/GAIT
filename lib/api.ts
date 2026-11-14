import { NextResponse } from "next/server";
import { getUserFromRequest, type User } from "./auth";
import { NotFoundError, UserFacingError } from "./claude";

/** Wraps a route handler: signed-in users only (401 otherwise), JSON in and out, no internal error text. */
export async function handle(req: Request, fn: (user: User) => Promise<unknown>) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  try {
    return NextResponse.json(await fn(user));
  } catch (e) {
    console.error(e);
    const known = e instanceof UserFacingError;
    const message = known ? e.message : "Something went wrong. Please try again.";
    return NextResponse.json({ error: message }, { status: e instanceof NotFoundError ? 404 : known ? 400 : 500 });
  }
}
