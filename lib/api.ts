import { NextResponse } from "next/server";
import { getUserFromRequest, type User } from "./auth";
import { aiContext, rateLimit } from "./limits";
import { NotFoundError, UserFacingError } from "./claude";

/** A user-facing error with its own status (413 too large, 429 too many requests). */
export class HttpError extends UserFacingError {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function requireDirector(user: User) {
  if (user.role !== "director") throw new HttpError(403, "Only the director can do that.");
}

// Rate limit for AI routes: counted in the database (lib/limits.ts), so it is shared across processes and restarts.
const AI_LIMIT = 20;
const AI_WINDOW_MS = 60_000;
export { rateLimit };

/**
 * Wraps a route handler: signed-in users only (401 otherwise), JSON in and out, no internal error text.
 * `ai: true` also rate-limits the route (429).
 */
export async function handle(req: Request, fn: (user: User) => Promise<unknown>, opts: { ai?: boolean; tutee?: boolean } = {}) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    if (user.role === "tutee" && !opts.tutee) return NextResponse.json({ error: "That is for tutors. Ask the Reading/Writing Center director." }, { status: 403 });
  if (opts.ai && !rateLimit(`ai:${user.id}`, AI_LIMIT, AI_WINDOW_MS)) {
      return NextResponse.json({ error: "Too many requests. Wait a minute and try again." }, { status: 429 });
    }
    return NextResponse.json(await aiContext.run({ userId: user.id, calls: 0 }, () => fn(user)));
  } catch (e) {
    console.error(e);
    const known = e instanceof UserFacingError;
    const message = known ? e.message : "Something went wrong. Please try again.";
    const status = e instanceof HttpError ? e.status : e instanceof NotFoundError ? 404 : known ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

const MAX_BODY = 100_000;

/** Reads a JSON object body, refusing anything over 100 KB (413) or not valid JSON (400). */
export async function readJson(req: Request, maxBytes = MAX_BODY): Promise<Record<string, unknown>> {
  const tooBig = () => new HttpError(413, "That is too much text to send at once.");
  if (Number(req.headers.get("content-length")) > maxBytes) throw tooBig();
  const reader = req.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw tooBig();
    }
    chunks.push(value);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new UserFacingError("The request was not valid.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new UserFacingError("The request was not valid.");
  return parsed as Record<string, unknown>;
}

/** A text field: missing becomes "", anything that is not a string or is too long is refused (400). */
export function str(value: unknown, max: number): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new UserFacingError("The request was not valid.");
  if (value.length > max) throw new UserFacingError("That text is too long.");
  return value;
}
